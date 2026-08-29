# auth.py
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from db_init import db
from models import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home_redirect'))
    
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if not (name and email and password):
            flash('All fields are required.', 'danger')
            return redirect(url_for('auth.register'))
            
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Email address already registered.', 'warning')
            return redirect(url_for('auth.register'))
            
        hashed_password = generate_password_hash(password, method='scrypt')
        new_user = User(name=name, email=email, password_hash=hashed_password)
        
        try:
            db.session.add(new_user)
            db.session.commit()
            login_user(new_user)
            flash('Registration successful!', 'success')
            return redirect(url_for('home_redirect'))
        except Exception as e:
            db.session.rollback()
            flash('An error occurred. Please try again.', 'danger')
            return redirect(url_for('auth.register'))
            
    return render_template('register.html')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home_redirect'))
        
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        remember = True if request.form.get('remember') else False
        
        if not (email and password):
            flash('Please enter both email and password.', 'danger')
            return redirect(url_for('auth.login'))
            
        user = User.query.filter_by(email=email).first()
        
        if not user or not check_password_hash(user.password_hash, password):
            flash('Invalid email or password.', 'danger')
            return redirect(url_for('auth.login'))
            
        login_user(user, remember=remember)
        return redirect(url_for('home_redirect'))
        
    return render_template('login.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully.', 'success')
    return redirect(url_for('auth.login'))

# Production JSON APIs for SPA frontend separated deployment
@auth_bp.route('/api/auth/register', methods=['POST'])
def api_register():
    if current_user.is_authenticated:
        return jsonify({"status": "error", "message": "Already authenticated"}), 400
        
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not (name and email and password):
        return jsonify({"status": "error", "message": "All fields are required"}), 400
        
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({"status": "error", "message": "Email address already registered"}), 400
        
    hashed_password = generate_password_hash(password, method='scrypt')
    new_user = User(name=name, email=email, password_hash=hashed_password)
    
    try:
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        return jsonify({
            "status": "ok",
            "message": "Registration successful",
            "user": {"name": new_user.name, "email": new_user.email}
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Database write failed: " + str(e)}), 500

@auth_bp.route('/api/auth/login', methods=['POST'])
def api_login():
    if current_user.is_authenticated:
        return jsonify({
            "status": "ok", 
            "message": "Already authenticated",
            "user": {"name": current_user.name, "email": current_user.email}
        }), 200
        
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    remember = True if data.get('remember') else False
    
    if not (email and password):
        return jsonify({"status": "error", "message": "Email and password are required"}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401
        
    login_user(user, remember=remember)
    return jsonify({
        "status": "ok",
        "message": "Login successful",
        "user": {"name": user.name, "email": user.email}
    }), 200

@auth_bp.route('/api/auth/logout', methods=['GET', 'POST'])
def api_logout():
    if current_user.is_authenticated:
        logout_user()
        return jsonify({"status": "ok", "message": "Logged out successfully"}), 200
    return jsonify({"status": "error", "message": "Not authenticated"}), 401

@auth_bp.route('/api/auth/me', methods=['GET'])
def api_me():
    if current_user.is_authenticated:
        return jsonify({
            "status": "ok",
            "authenticated": True,
            "user": {"name": current_user.name, "email": current_user.email}
        }), 200
    return jsonify({
        "status": "ok",
        "authenticated": False
    }), 200
