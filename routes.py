# routes.py
import re
from datetime import datetime, date
from flask import Blueprint, request, jsonify, render_template, send_file
from flask_login import login_required, current_user
import io
import csv
import json
import requests
from db_init import db
from models import Transaction, Budget, Goal

api_bp = Blueprint('api', __name__)

# Heuristic lists for local rule-based categorization as a robust fallback
CATEGORY_KEYWORDS = {
    'Food': ['swiggy', 'zomato', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'food', 'starbucks', 'dominos', 'pizza', 'burger'],
    'Groceries': ['grocery', 'supermarket', 'mart', 'blinkit', 'zepto', 'instamart', 'milk', 'vegetables', 'fruits', 'groceries'],
    'Shopping': ['amazon', 'flipkart', 'myntra', 'clothes', 'shoes', 'electronics', 'shopping', 'mall', 'zara', 'h&m'],
    'Travel': ['hotel', 'flight', 'ticket', 'vacation', 'trip', 'booking', 'stay', 'travel', 'holiday'],
    'Transport': ['uber', 'ola', 'auto', 'cab', 'metro', 'train', 'bus', 'petrol', 'fuel', 'diesel', 'rapido', 'taxi', 'transport'],
    'Bills': ['electricity', 'water', 'gas', 'recharge', 'wifi', 'internet', 'mobile', 'dth', 'bill', 'insurance', 'broadband'],
    'Rent': ['rent', 'owner', 'pg', 'flat', 'maintenance'],
    'Education': ['tuition', 'school', 'college', 'course', 'book', 'fees', 'udemy', 'coursera', 'education'],
    'Salary': ['salary', 'payout', 'credit', 'income', 'bonus', 'wage', 'dividends'],
    'Entertainment': ['netflix', 'prime', 'spotify', 'movie', 'cinema', 'theatre', 'game', 'club', 'pub', 'showbook'],
    'Health': ['pharmacy', 'medicine', 'doctor', 'hospital', 'gym', 'health', 'clinic', 'medical'],
}

PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other']

@api_bp.route('/transactions', methods=['GET'])
@login_required
def get_transactions():
    try:
        # Get query parameters
        category = request.args.get('category')
        payment_method = request.args.get('payment_method')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search')
        
        query = Transaction.query.filter_by(user_id=current_user.id)
        
        if category:
            query = query.filter(Transaction.category == category)
        if payment_method:
            query = query.filter(Transaction.payment_method == payment_method)
        if start_date:
            query = query.filter(Transaction.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(Transaction.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        if search:
            query = query.filter(Transaction.description.ilike(f'%{search}%'))
            
        transactions = query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()
        
        result = [{
            'id': t.id,
            'date': t.date.strftime('%Y-%m-%d'),
            'type': t.type,
            'amount': t.amount,
            'category': t.category,
            'description': t.description,
            'payment_method': t.payment_method,
            'notes': t.notes
        } for t in transactions]
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@api_bp.route('/transactions', methods=['POST'])
@login_required
def create_transaction():
    try:
        data = request.get_json() or {}
        
        # Validations
        date_str = data.get('date')
        if date_str:
            txn_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            txn_date = date.today()
            
        txn_type = data.get('type', 'Expense')
        amount = float(data.get('amount', 0))
        category = data.get('category', 'Other')
        description = data.get('description', '')
        payment_method = data.get('payment_method', 'Other')
        notes = data.get('notes', '')
        
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than zero.'}), 400
            
        txn = Transaction(
            user_id=current_user.id,
            date=txn_date,
            type=txn_type,
            amount=amount,
            category=category,
            description=description,
            payment_method=payment_method,
            notes=notes
        )
        
        db.session.add(txn)
        db.session.commit()
        
        return jsonify({
            'message': 'Transaction added successfully!',
            'transaction': {
                'id': txn.id,
                'date': txn.date.strftime('%Y-%m-%d'),
                'type': txn.type,
                'amount': txn.amount,
                'category': txn.category,
                'description': txn.description,
                'payment_method': txn.payment_method,
                'notes': txn.notes
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@api_bp.route('/transactions/<int:id>', methods=['PUT'])
@login_required
def update_transaction(id):
    try:
        txn = Transaction.query.filter_by(id=id, user_id=current_user.id).first_or_404()
        data = request.get_json() or {}
        
        if 'date' in data:
            txn.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        if 'type' in data:
            txn.type = data['type']
        if 'amount' in data:
            txn.amount = float(data['amount'])
        if 'category' in data:
            txn.category = data['category']
        if 'description' in data:
            txn.description = data['description']
        if 'payment_method' in data:
            txn.payment_method = data['payment_method']
        if 'notes' in data:
            txn.notes = data['notes']
            
        db.session.commit()
        return jsonify({'message': 'Transaction updated successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@api_bp.route('/transactions/<int:id>', methods=['DELETE'])
@login_required
def delete_transaction(id):
    try:
        txn = Transaction.query.filter_by(id=id, user_id=current_user.id).first_or_404()
        db.session.delete(txn)
        db.session.commit()
        return jsonify({'message': 'Transaction deleted successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@api_bp.route('/summary', methods=['GET'])
@login_required
def get_summary():
    try:
        # Get query parameters for filtering the statistics
        month_str = request.args.get('month') # YYYY-MM
        if month_str:
            year, month = map(int, month_str.split('-'))
            txns = Transaction.query.filter_by(user_id=current_user.id).filter(
                db.extract('year', Transaction.date) == year,
                db.extract('month', Transaction.date) == month
            ).all()
        else:
            txns = Transaction.query.filter_by(user_id=current_user.id).all()
            
        total_income = 0.0
        total_expenses = 0.0
        category_breakdown = {}
        payment_breakdown = {}
        monthly_trend = {}
        
        for t in txns:
            m_key = t.date.strftime('%Y-%m')
            if m_key not in monthly_trend:
                monthly_trend[m_key] = {'income': 0.0, 'expense': 0.0}
                
            if t.type == 'Income':
                total_income += t.amount
                monthly_trend[m_key]['income'] += t.amount
            else:
                total_expenses += t.amount
                monthly_trend[m_key]['expense'] += t.amount
                
                # Category breakdown
                category_breakdown[t.category] = category_breakdown.get(t.category, 0.0) + t.amount
                
            # Payment breakdown (both types or just expenses? Let's do expenses for payment breakdown)
            if t.type == 'Expense':
                payment_breakdown[t.payment_method] = payment_breakdown.get(t.payment_method, 0.0) + t.amount
                
        net_balance = total_income - total_expenses
        
        return jsonify({
            'total_income': total_income,
            'total_expenses': total_expenses,
            'net_balance': net_balance,
            'transaction_count': len(txns),
            'category_breakdown': category_breakdown,
            'payment_breakdown': payment_breakdown,
            'monthly_trend': monthly_trend
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@api_bp.route('/ai/categorize', methods=['POST'])
@login_required
def ai_categorize():
    try:
        data = request.get_json() or {}
        text = data.get('text', '').strip()
        
        if not text:
            return jsonify({'error': 'No input text provided.'}), 400
            
        # 1. Look for currency and amount
        # Regex to find currency symbols and amounts (e.g. ₹450, Rs 500, 250rs, 250, 45.50)
        amount_match = re.search(r'(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d{1,2})?)\s*(?:rs|rupees|rupee)?', text, re.IGNORECASE)
        amount = 0.0
        if amount_match:
            amount = float(amount_match.group(1))
            # Remove the amount from the text to categorize the rest
            text_for_category = text.replace(amount_match.group(0), '').strip()
        else:
            text_for_category = text
            
        # 2. Local rule-based keyword matching
        detected_category = 'Other'
        matched_keyword = None
        for category, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if re.search(r'\b' + re.escape(kw) + r'\b', text_for_category, re.IGNORECASE):
                    detected_category = category
                    matched_keyword = kw
                    break
            if detected_category != 'Other':
                break
                
        # Define default transaction type based on category
        txn_type = 'Income' if detected_category in ['Salary'] else 'Expense'
        
        # Payment method detection
        detected_payment = 'UPI'  # Default
        for pm in PAYMENT_METHODS:
            if re.search(r'\b' + re.escape(pm) + r'\b', text, re.IGNORECASE):
                detected_payment = pm
                break
                
        # Clean description
        description = text_for_category or text
        # Remove common fill words
        description = re.sub(r'\b(?:spent|for|on|bought|paid|received|rupees|rs|rupee|INR|in)\b', '', description, flags=re.IGNORECASE)
        description = re.sub(r'\s+', ' ', description).strip().capitalize()
        
        return jsonify({
            'amount': amount,
            'category': detected_category,
            'type': txn_type,
            'description': description or 'AI Logged Expense',
            'payment_method': detected_payment,
            'matched_keyword': matched_keyword
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@api_bp.route('/ai/insights', methods=['GET'])
@login_required
def ai_insights():
    try:
        txns = Transaction.query.filter_by(user_id=current_user.id).all()
        if not txns:
            return jsonify({
                'insights': [
                    "Welcome! Start logging your daily expenses to receive customized AI financial insights and budgeting suggestions."
                ]
            })
            
        insights = []
        
        # Calculate summary metrics
        total_expense = sum(t.amount for t in txns if t.type == 'Expense')
        total_income = sum(t.amount for t in txns if t.type == 'Income')
        
        # Category aggregation
        category_sums = {}
        for t in txns:
            if t.type == 'Expense':
                category_sums[t.category] = category_sums.get(t.category, 0.0) + t.amount
                
        # 1. Savings rate insight
        if total_income > 0:
            savings_rate = ((total_income - total_expense) / total_income) * 100
            if savings_rate < 10:
                insights.append(f"⚠️ Your savings rate is low at {savings_rate:.1f}%. Consider setting strict budgets for discretionary categories like Shopping or Entertainment.")
            elif savings_rate >= 30:
                insights.append(f"✨ Excellent job! You are saving {savings_rate:.1f}% of your income. Consider allocating some of these savings to long-term goals.")
            else:
                insights.append(f"📊 Your savings rate is healthy at {savings_rate:.1f}%. You are on track to build a solid financial safety net.")
        else:
            insights.append("💡 Log your monthly income to unlock your savings rate percentage and custom budget allocations.")
            
        # 2. Category high spending detection
        if category_sums:
            highest_category = max(category_sums, key=category_sums.get)
            highest_amount = category_sums[highest_category]
            category_percentage = (highest_amount / total_expense * 100) if total_expense > 0 else 0
            
            if category_percentage > 40 and highest_category not in ['Rent']:
                insights.append(f"📈 High spending detected in *{highest_category}* (₹{highest_amount:.2f}), making up {category_percentage:.1f}% of your total expenses. Try using food prep or public transit to cut down.")
            else:
                insights.append(f"🏷️ Your primary expense category is *{highest_category}* (₹{highest_amount:.2f}), which comprises {category_percentage:.1f}% of your monthly outflow.")
                
        # 3. Weekend vs Weekday analysis
        weekend_expense = 0.0
        weekday_expense = 0.0
        for t in txns:
            if t.type == 'Expense':
                # 5 is Saturday, 6 is Sunday
                if t.date.weekday() in [5, 6]:
                    weekend_expense += t.amount
                else:
                    weekday_expense += t.amount
                    
        if weekend_expense > weekday_expense * 1.5:
            insights.append("🎉 You spend significantly more on weekends! Check if you can curb impulsive leisure expenses on Saturdays and Sundays.")
            
        # 4. Recurring subscriptions detection
        descriptions = {}
        for t in txns:
            if t.type == 'Expense':
                descriptions[t.description.lower()] = descriptions.get(t.description.lower(), []) + [t]
                
        recurring_detected = []
        for desc, items in descriptions.items():
            if len(items) >= 2:
                # Check interval if dates are about a month apart
                dates = sorted([i.date for i in items])
                intervals = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
                if any(25 <= interval <= 35 for interval in intervals):
                    recurring_detected.append(items[0].description)
                    
        if recurring_detected:
            insights.append(f"🔄 Recurring payments detected: *{', '.join(recurring_detected)}*. Ensure you cancel any unused subscriptions to save monthly cash.")
            
        return jsonify({'insights': insights})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@api_bp.route('/export', methods=['GET'])
@login_required
def export_data():
    try:
        txns = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Date', 'Type', 'Amount (INR)', 'Category', 'Description', 'Payment Method', 'Notes'])
        
        for t in txns:
            writer.writerow([
                t.date.strftime('%Y-%m-%d'),
                t.type,
                t.amount,
                t.category,
                t.description,
                t.payment_method,
                t.notes
            ])
            
        mem = io.BytesIO()
        mem.write(output.getvalue().encode('utf-8'))
        mem.seek(0)
        output.close()
        
        return send_file(
            mem,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'expenses_{datetime.now().strftime("%Y%m%d")}.csv'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 400
