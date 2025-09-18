# your app.py
from flask import Flask, request, jsonify
import flask_profiler

app = Flask(__name__)
app.config["DEBUG"] = True

# You need to declare necessary configuration to initialize
# flask-profiler as follows:
app.config["flask_profiler"] = {
    "verbose": True,
    "enabled": app.config["DEBUG"],
    "storage": {
        "engine": "sqlalchemy",
        "db_url": "sqlite:///flask_profiler.sql"  # optional
    },
    "basicAuth":{
        "enabled": True,
        "username": "admin",
        "password": "admin"
    },
    "ignore": [
        "/static/*",
        "/secrets/password/"
    ]
}


@app.route('/product/<id>', methods=['GET'])
def getProduct(id):
    return "product id is " + str(id)


@app.route('/product/<id>', methods=['PUT'])
def updateProduct(id):
    return "product {} is being updated".format(id)


@app.route('/products', methods=['GET'])
def listProducts():
    return "suppose I send you product list..."


@app.route('/static/photo/', methods=['GET'])
def getPhoto():
    return "your photo"


@app.route('/add', methods=['POST'])
def add_numbers():
    data = request.get_json()
    if not data or 'a' not in data or 'b' not in data:
        return jsonify({'error': 'Please provide both "a" and "b" numbers'}), 400

    try:
        a = float(data['a'])
        b = float(data['b'])
        result = a + b
        return jsonify({'result': result, 'a': a, 'b': b})
    except (TypeError, ValueError):
        return jsonify({'error': 'Both "a" and "b" must be valid numbers'}), 400


@app.route('/orders/<order_id>', methods=['PATCH'])
def patch_order(order_id):
    changes = request.get_json(silent=True) or {}
    return jsonify({'status': 'patched', 'order_id': order_id, 'changes': changes})


@app.route('/orders/<order_id>', methods=['DELETE'])
def delete_order(order_id):
    return jsonify({'status': 'deleted', 'order_id': order_id}), 204


@app.route('/inventory', methods=['OPTIONS'])
def inventory_options():
    response = jsonify({'allow': ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']})
    response.headers['Allow'] = 'GET,POST,PATCH,DELETE,OPTIONS,HEAD'
    return response


@app.route('/inventory', methods=['HEAD'])
def inventory_head():
    response = app.response_class(status=200)
    response.headers['X-Inventory-Count'] = '42'
    return response


# In order to active flask-profiler, you have to pass flask
# app as an argument to flask-provider.
# All the endpoints declared so far will be tracked by flask-provider.
flask_profiler.init_app(app)


# endpoint declarations after flask_profiler.init_app() will be
# hidden to flask_profider.
@app.route('/doSomething', methods=['GET'])
def doSomething():
    return "flask-provider will not measure this."


# But in case you want an endpoint to be measured by flask-provider,
# you can specify this explicitly by using profile() decorator
@app.route('/doSomething', methods=['GET'])
@flask_profiler.profile()
def doSomethingImportant():
    return "flask-provider will measure this request."

if __name__ == '__main__':
    app.run(host="127.0.0.1", port=5000)
