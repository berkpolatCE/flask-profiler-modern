import sqlite3
import json
import re
from .base import BaseStorage
from datetime import datetime
import time
import threading


def formatDate(timestamp, dateFormat):
    return datetime.fromtimestamp(timestamp).strftime(dateFormat)


class Sqlite(BaseStorage):
    """docstring for Sqlite"""
    
    ALLOWED_SORT_MAIN = {"ID", "startedAt", "endedAt", "elapsed", "method", "name"}
    ALLOWED_SORT_SUMMARY = {"method", "name", "count", "minElapsed", "maxElapsed", "avgElapsed"}
    
    def __init__(self, config=None):
        super(Sqlite, self).__init__()
        self.config = config
        self.sqlite_file = self.config.get("FILE", "flask_profiler.sql")
        self.table_name = self.config.get("TABLE", "measurements")
        
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', self.table_name):
            raise ValueError(f"Invalid table name: {self.table_name}")

        self.startedAt_head = 'startedAt'  # name of the column
        self.endedAt_head = 'endedAt'  # name of the column
        self.elapsed_head = 'elapsed'  # name of the column
        self.method_head = 'method'
        self.args_head = 'args'
        self.kwargs_head = 'kwargs'
        self.name_head = 'name'
        self.context_head = 'context'

        self.connection = sqlite3.connect(
            self.sqlite_file, check_same_thread=False)
        self.cursor = self.connection.cursor()

        self.lock = threading.Lock()
        self.create_database()

    def __enter__(self):
        return self
    
    def _sanitize_sort(self, requested, allowed, default_field, default_dir="DESC"):
        field = (requested[0].strip() if requested else default_field)
        direction = (requested[1].strip() if len(requested) > 1 else default_dir).upper()
        if field not in allowed:
            field = default_field
        if direction not in ("ASC", "DESC"):
            direction = default_dir
        return field, direction

    @staticmethod
    def getFilters(kwargs):
        filters = {}
        filters["sort"] = kwargs.get('sort', "endedAt,desc").split(",")

        # because inserting and filtering may take place at the same moment,
        # a very little increment(0.5) is needed to find inserted
        # record by sql.
        filters["endedAt"] = float(
            kwargs.get('endedAt', time.time() + 0.5))
        filters["startedAt"] = float(
            kwargs.get('startedAt', time.time() - 3600 * 24 * 7))

        filters["elapsed"] = kwargs.get('elapsed', None)
        filters["method"] = kwargs.get('method', None)
        filters["name"] = kwargs.get('name', None)
        filters["args"] = json.dumps(
            list(kwargs.get('args', ())))  # tuple -> list -> json
        filters["kwargs"] = json.dumps(kwargs.get('kwargs', ()))
        filters["skip"] = int(kwargs.get('skip', 0))
        filters["limit"] = int(kwargs.get('limit', 100))
        return filters

    def create_database(self):
        with self.lock:
            sql = f'''CREATE TABLE IF NOT EXISTS "{self.table_name}"
                (
                ID Integer PRIMARY KEY AUTOINCREMENT,
                {self.startedAt_head} REAL,
                {self.endedAt_head} REAL,
                {self.elapsed_head} REAL,
                {self.args_head} TEXT,
                {self.kwargs_head} TEXT,
                {self.method_head} TEXT,
                {self.context_head} TEXT,
                {self.name_head} TEXT
                );
            '''
            self.cursor.execute(sql)

            sql = f'''
            CREATE INDEX IF NOT EXISTS measurement_index ON "{self.table_name}"
                ({self.startedAt_head}, {self.endedAt_head}, {self.elapsed_head}, {self.name_head}, {self.method_head});
            '''
            self.cursor.execute(sql)

            self.connection.commit()

    def insert(self, kwds):
        endedAt = float(kwds.get('endedAt', None))
        startedAt = float(kwds.get('startedAt', None))
        elapsed = kwds.get('elapsed', None)
        args = json.dumps(list(kwds.get('args', ())))  # tuple -> list -> json
        kwargs = json.dumps(kwds.get('kwargs', ()))
        context = json.dumps(kwds.get('context', {}))
        method = kwds.get('method', None)
        name = kwds.get('name', None)

        sql = f'''INSERT INTO "{self.table_name}" 
            (startedAt, endedAt, elapsed, args, kwargs, method, context, name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)'''

        with self.lock:
            self.cursor.execute(sql, (
                    startedAt,
                    endedAt,
                    elapsed,
                    args,
                    kwargs,
                    method,
                    context,
                    name))

            self.connection.commit()

    def getTimeseries(self, kwds={}):
        filters = Sqlite.getFilters(kwds)

        if kwds.get('interval', None) == "daily":
            interval = 3600 * 24   # daily
            dateFormat = '%Y-%m-%d'
        else:
            interval = 3600  # hourly
            dateFormat = '%Y-%m-%d %H'

        endedAt, startedAt = filters["endedAt"], filters["startedAt"]

        with self.lock:
            sql = f'''SELECT startedAt, count(id) as count
                      FROM "{self.table_name}"
                      WHERE endedAt <= ? AND startedAt >= ?
                      GROUP BY strftime("{dateFormat}", datetime(startedAt, 'unixepoch'))
                      ORDER BY startedAt ASC'''
            
            self.cursor.execute(sql, (endedAt, startedAt))
            rows = self.cursor.fetchall()

        series = {}
        for i in range(int(startedAt), int(endedAt) + 1, interval):
            series[formatDate(i, dateFormat)] = 0

        for row in rows:
            series[formatDate(row[0], dateFormat)] = row[1]
        return series

    def getMethodDistribution(self, kwds=None):
        if not kwds:
            kwds = {}
        f = Sqlite.getFilters(kwds)
        endedAt, startedAt = f["endedAt"], f["startedAt"]

        with self.lock:
            sql = f'''SELECT method, count(id) as count
                      FROM "{self.table_name}"
                      WHERE endedAt <= ? AND startedAt >= ?
                      GROUP BY method'''
            
            self.cursor.execute(sql, (endedAt, startedAt))
            rows = self.cursor.fetchall()

        results = {}
        for row in rows:
            results[row[0]] = row[1]
        return results

    def filter(self, kwds={}):
        f = Sqlite.getFilters(kwds)
        where_clauses, params = [], []
        
        if f["endedAt"] is not None:
            where_clauses.append("endedAt <= ?")
            params.append(float(f["endedAt"]))
        if f["startedAt"] is not None:
            where_clauses.append("startedAt >= ?")
            params.append(float(f["startedAt"]))
        if f["elapsed"] not in (None, ""):
            where_clauses.append("elapsed >= ?")
            params.append(float(f["elapsed"]))
        if f["method"]:
            where_clauses.append("method = ?")
            params.append(f["method"])
        if f["name"]:
            where_clauses.append("name = ?")
            params.append(f["name"])
        
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        sort_field, sort_dir = self._sanitize_sort(
            f["sort"],
            allowed=self.ALLOWED_SORT_MAIN,
            default_field="endedAt",
            default_dir="DESC"
        )
        
        sql = f'''SELECT ID, startedAt, endedAt, elapsed, args, kwargs, method, context, name
                  FROM "{self.table_name}" {where_sql}
                  ORDER BY {sort_field} {sort_dir}
                  LIMIT ? OFFSET ?'''
        
        params.extend([int(f['limit']), int(f['skip'])])
        
        with self.lock:
            self.cursor.execute(sql, params)
            rows = self.cursor.fetchall()
        return (self.jsonify_row(row) for row in rows)

    def get(self, measurementId):
        with self.lock:
            self.cursor.execute(
                f'SELECT * FROM "{self.table_name}" WHERE ID=?', (int(measurementId),)
            )
            rows = self.cursor.fetchall()
        
        if not rows:
            return None
        
        return self.jsonify_row(rows[0])

    def truncate(self):
        with self.lock:
            self.cursor.execute(f'DELETE FROM "{self.table_name}"')
            self.connection.commit()
        return True if self.cursor.rowcount else False

    def delete(self, measurementId):
        with self.lock:
            self.cursor.execute(
                f'DELETE FROM "{self.table_name}" WHERE ID=?', (int(measurementId),)
            )
            return self.connection.commit()

    def jsonify_row(self, row):
        data = {
            "id": row[0],
            "startedAt": row[1],
            "endedAt": row[2],
            "elapsed": row[3],
            "args": tuple(json.loads(row[4])),  # json -> list -> tuple
            "kwargs": json.loads(row[5]),
            "method": row[6],
            "context": json.loads(row[7]),
            "name": row[8]
        }

        return data

    def getSummary(self, kwds={}):
        filters = Sqlite.getFilters(kwds)
        where_clauses, params = [], []
        
        if filters["startedAt"] is not None:
            where_clauses.append("startedAt >= ?")
            params.append(float(filters["startedAt"]))
        if filters["endedAt"] is not None:
            where_clauses.append("endedAt <= ?")
            params.append(float(filters["endedAt"]))
        if filters["elapsed"] not in (None, ""):
            where_clauses.append("elapsed >= ?")
            params.append(float(filters["elapsed"]))
        
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        sort_field, sort_dir = self._sanitize_sort(
            filters["sort"], self.ALLOWED_SORT_SUMMARY, default_field="count", default_dir="DESC"
        )
        
        sql = f'''SELECT method, name,
                         count(id) as count,
                         min(elapsed) as minElapsed,
                         max(elapsed) as maxElapsed,
                         avg(elapsed) as avgElapsed
                  FROM "{self.table_name}" {where_sql}
                  GROUP BY method, name
                  ORDER BY {sort_field} {sort_dir}'''
        
        with self.lock:
            self.cursor.execute(sql, params)
            rows = self.cursor.fetchall()

        result = []
        for r in rows:
            result.append({
                "method": r[0],
                "name": r[1],
                "count": r[2],
                "minElapsed": r[3],
                "maxElapsed": r[4],
                "avgElapsed": r[5]
            })
        return result

    def __exit__(self, exc_type, exc_value, traceback):
        return self.connection.close()
