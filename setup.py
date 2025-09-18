"""
Flask-Profiler
-------------

Flask Profiler

Links
`````

* `development version <http://github.com/muatik/flask-profiler/>`

"""
from setuptools import setup


tests_require = [
    "Flask-Testing",
    "simplejson",
    "sqlalchemy"
]

install_requires = [
    'Flask>=2.0.0',
    'Flask-HTTPAuth>=4.0.0',
    'simplejson>=3.17.0'
]

setup(
    name='flask_profiler',
    version='1.8.1',
    url='https://github.com/muatik/flask-profiler',
    license='MIT',
    author='Mustafa Atik',
    author_email='muatik@gmail.com',
    maintainer='Berk Polat',
    maintainer_email='berkopolat@gmail.com',
    description='API endpoint profiler for Flask framework',
    python_requires='>=3.8',
    keywords=[
        'profiler', 'flask', 'performance', 'optimization'
    ],
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    packages=['flask_profiler'],
    package_data={
        'flask_profiler': [
            'storage/*',
            'static/dist/fonts/*',
            'static/dist/css/*',
            'static/dist/js/*',
            'static/dist/images/*',
            'static/dist/js/*',
            'static/dist/*',
            'static/dist/index.html',
            ]
        },
    test_suite="tests.suite",
    zip_safe=False,
    platforms='any',
    install_requires=install_requires,
    tests_require=tests_require,
    classifiers=[
        'Environment :: Web Environment',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
        'Topic :: Software Development :: Libraries :: Python Modules'
    ]
)
