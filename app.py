# app.py
import os
from flask import Flask, render_template, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///expense_tracker.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
from db_init import db
db.init_app(app)
login_manager = LoginManager(app)
login_manager.login_view = 'auth.login'

# Configure CORS
from flask_cors import CORS
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000').split(',')
CORS(app, supports_credentials=True, origins=cors_origins)

# Production Cookie configurations for cross-domain sessions
is_prod = os.getenv('FLASK_ENV') == 'production' or os.getenv('DATABASE_URL') is not None
if is_prod:
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    # Also adjust SQLite to PostgreSQL if DATABASE_URL is PostgreSQL
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        # Render PostgreSQL url fix (replace postgres:// with postgresql://)
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = db_url

# Import models and blueprints after init to avoid circular imports
from models import User, Transaction, Budget, Goal
from auth import auth_bp
from routes import api_bp

app.register_blueprint(auth_bp)
app.register_blueprint(api_bp, url_prefix='/api')

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# API Health Check
@app.route('/api/health')
def health_check():
    return jsonify({
        "status": "ok",
        "environment": "production" if is_prod else "development",
        "database": "connected"
    })

@app.route('/')
def home_redirect():
    return redirect('/api/health')


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0')
