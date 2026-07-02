"""
Cyber Attack Prediction System - Flask Backend
REST API for network traffic analysis and attack detection
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import pickle
import os
from datetime import datetime
from typing import Dict, List, Any

app = Flask(__name__)
CORS(app)

ALERT_STORAGE: List[Dict[str, Any]] = []
MODEL = None
SCALER = None
FEATURE_NAMES = [
    'duration', 'protocol_type', 'service', 'flag', 'src_bytes', 'dst_bytes',
    'land', 'wrong_fragment', 'urgent', 'hot', 'num_failed_logins', 'logged_in',
    'num_compromised', 'root_shell', 'su_attempted', 'num_root', 'num_file_creations',
    'num_shells', 'num_access_files', 'is_guest_login', 'count', 'srv_count',
    'serror_rate', 'srv_serror_rate', 'rerror_rate', 'srv_rerror_rate',
    'same_srv_rate', 'diff_srv_rate', 'srv_diff_host_rate', 'dst_host_count',
    'dst_host_srv_count', 'dst_host_same_srv_rate', 'dst_host_diff_srv_rate',
    'dst_host_same_src_port_rate', 'dst_host_serror_rate', 'dst_host_srv_serror_rate',
    'dst_host_rerror_rate', 'dst_host_srv_rerror_rate'
]

ATTACK_MAPPING = {
    'normal': ('Normal', 'Low'),
    'neptune': ('DDoS', 'High'),
    'satan': ('Probe', 'Medium'),
    'ipsweep': ('Probe', 'Medium'),
    'nmap': ('Probe', 'Medium'),
    'portsweep': ('Probe', 'Medium'),
    'smsweep': ('Probe', 'Medium'),
    'teardrop': ('DDoS', 'High'),
    'pod': ('DDoS', 'High'),
    'guess_passwd': ('R2L', 'High'),
    'ftp_write': ('R2L', 'High'),
    'imap': ('R2L', 'High'),
    'multihop': ('R2L', 'High'),
    'warezmaster': ('R2L', 'High'),
    'warezclient': ('R2L', 'High'),
    'spy': ('U2R', 'High'),
    'phf': ('U2R', 'High'),
    'buffer_overflow': ('U2R', 'High'),
    'loadmodule': ('U2R', 'High'),
    'rootkit': ('U2R', 'High'),
    'back': ('DDoS', 'High'),
    'land': ('DDoS', 'High'),
    'processtable': ('Probe', 'Medium')
}

PROTOCOL_TYPES = {'tcp': 1, 'udp': 2, 'icmp': 3}
SERVICE_TYPES = {
    'http': 1, 'ftp': 2, 'smtp': 3, 'dns': 4, 'ssh': 5, 'telnet': 6,
    'domain': 7, 'auth': 8, 'ftp_data': 9, 'imap4': 10, 'echo': 11,
    'discard': 12, 'daytime': 13, 'shell': 14, 'login': 15, 'supdup': 16,
    'exec': 17, 'finger': 18, 'hostnames': 19, 'isolior': 20, 'netbios_ns': 21,
    'courier': 22, 'uucp': 23, 'klogin': 24, 'kshell': 25, 'icmp': 26, 'pop_3': 27,
    'ntp': 28, 'pm_dump': 29, 'red_i': 30, 'mysql': 31, 'sql_net': 32, 'postgres': 33,
    'Z39_50': 34, 'netstat': 35, 'http_443': 36, 'urh': 37, 'urp': 38, 'aol': 39,
    'jap': 40, 'editor': 41, 'X11': 42, 'IRC': 43, 'RAYS': 44, 'gg': 45,
    'SSHDR': 46, 'fire': 47, 'sftp': 48, 'utf-8': 49, 'other': 50
}
FLAG_TYPES = {
    'SF': 1, 'S0': 2, 'REJ': 3, 'RSTO': 4, 'RSTOS0': 5,
    'SH': 6, 'S1': 7, 'S2': 8, 'S3': 9, 'SHR': 10, 'OTH': 11
}


def load_model():
    """Load the trained model and scaler"""
    global MODEL, SCALER
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'attack_model.pkl')
    scaler_path = os.path.join(os.path.dirname(__file__), 'models', 'scaler.pkl')
    
    if os.path.exists(model_path) and os.path.exists(scaler_path):
        with open(model_path, 'rb') as f:
            MODEL = pickle.load(f)
        with open(scaler_path, 'rb') as f:
            SCALER = pickle.load(f)
        print("Model loaded successfully")
    else:
        print("Model not found. Run training first.")


def preprocess_input(data: Dict[str, Any]) -> np.ndarray:
    """Preprocess network traffic data for prediction"""
    features = []
    
    for feature in FEATURE_NAMES:
        value = data.get(feature, 0)
        
        if feature == 'protocol_type':
            value = PROTOCOL_TYPES.get(str(value).lower(), 1)
        elif feature == 'service':
            value = SERVICE_TYPES.get(str(value).lower(), 50)
        elif feature == 'flag':
            value = FLAG_TYPES.get(str(value).upper(), 1)
        
        features.append(float(value))
    
    features_array = np.array(features).reshape(1, -1)
    
    if SCALER:
        features_array = SCALER.transform(features_array)
    
    return features_array


def get_attack_info(prediction: str) -> Dict[str, str]:
    """Get attack type and threat level"""
    return ATTACK_MAPPING.get(prediction.lower(), ('Unknown', 'Low'))


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'model_loaded': MODEL is not None
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict endpoint - takes network traffic data and returns prediction
    
    Request body (JSON):
    {
        "duration": 0,
        "protocol_type": "tcp",
        "service": "http",
        "flag": "SF",
        "src_bytes": 200,
        "dst_bytes": 1000,
        ...
    }
    
    Response (JSON):
    {
        "prediction": "normal",
        "attack_type": "Normal",
        "threat_level": "Low",
        "confidence": 0.95,
        "timestamp": "2024-01-01T00:00:00"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        features = preprocess_input(data)
        
        if MODEL is None:
            load_model()
        
        if MODEL is None:
            return jsonify({'error': 'Model not loaded. Train the model first.'}), 500
        
        prediction = MODEL.predict(features)[0]
        probabilities = MODEL.predict_proba(features)[0]
        confidence = float(max(probabilities))
        
        attack_type, threat_level = get_attack_info(prediction)
        
        result = {
            'prediction': str(prediction),
            'attack_type': attack_type,
            'threat_level': threat_level,
            'confidence': round(confidence, 4),
            'timestamp': datetime.utcnow().isoformat(),
            'all_probabilities': {
                str(cls): round(float(prob), 4) 
                for cls, prob in zip(MODEL.classes_, probabilities)
            }
        }
        
        if attack_type != 'Normal':
            alert = {
                'id': f"alert_{len(ALERT_STORAGE) + 1}",
                'severity': threat_level,
                'title': f"{attack_type} Attack Detected",
                'prediction': prediction,
                'confidence': confidence,
                'timestamp': result['timestamp'],
                'data': data
            }
            ALERT_STORAGE.append(alert)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """
    Batch prediction endpoint for multiple network traffic records
    """
    try:
        data = request.get_json()
        
        if not data or 'records' not in data:
            return jsonify({'error': 'No records provided'}), 400
        
        records = data['records']
        results = []
        
        for record in records:
            features = preprocess_input(record)
            prediction = MODEL.predict(features)[0]
            probabilities = MODEL.predict_proba(features)[0]
            attack_type, threat_level = get_attack_info(prediction)
            
            results.append({
                'prediction': str(prediction),
                'attack_type': attack_type,
                'threat_level': threat_level,
                'confidence': round(float(max(probabilities)), 4)
            })
        
        return jsonify({'predictions': results})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/upload-log', methods=['POST'])
def upload_log():
    """
    Upload CSV/log file for analysis
    
    Request: multipart/form-data with file
    
    Response (JSON):
    {
        "filename": "network_log.csv",
        "records": 1000,
        "analysis": {...}
    }
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        filename = file.filename
        
        if not filename.endswith('.csv'):
            return jsonify({'error': 'Only CSV files supported'}), 400
        
        df = pd.read_csv(file)
        
        required_cols = ['duration', 'protocol_type', 'service', 'flag']
        missing = [col for col in required_cols if col not in df.columns]
        
        if missing:
            return jsonify({'error': f'Missing columns: {missing}'}), 400
        
        predictions = []
        for _, row in df.iterrows():
            features = preprocess_input(row.to_dict())
            prediction = MODEL.predict(features)[0]
            predictions.append(prediction)
        
        attack_counts = pd.Series(predictions).value_counts().to_dict()
        
        result = {
            'filename': filename,
            'records': len(df),
            'analysis': {
                'predictions': attack_counts,
                'total_attacks': sum(v for k, v in attack_counts.items() if k != 'normal'),
                'normal_traffic': attack_counts.get('normal', 0)
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/alerts', methods=['GET'])
def get_alerts():
    """
    Get detected threats/alerts
    
    Query parameters:
    - severity: filter by severity (Low, Medium, High)
    - limit: number of alerts to return (default: 50)
    
    Response (JSON):
    {
        "alerts": [...],
        "count": 10
    }
    """
    try:
        severity = request.args.get('severity')
        limit = int(request.args.get('limit', 50))
        
        alerts = ALERT_STORAGE
        
        if severity:
            alerts = [a for a in alerts if a.get('severity') == severity]
        
        alerts = alerts[-limit:]
        
        return jsonify({
            'alerts': alerts,
            'count': len(alerts)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/alerts/<alert_id>', methods=['DELETE'])
def delete_alert(alert_id: str):
    """Delete an alert by ID"""
    global ALERT_STORAGE
    
    ALERT_STORAGE = [a for a in ALERT_STORAGE if a.get('id') != alert_id]
    
    return jsonify({'success': True, 'message': f'Alert {alert_id} deleted'})


@app.route('/statistics', methods=['GET'])
def get_statistics():
    """
    Get system statistics
    
    Response (JSON):
    {
        "total_predictions": 1000,
        "attack_types": {...},
        "threat_levels": {...}
    }
    """
    try:
        if not ALERT_STORAGE:
            return jsonify({
                'total_alerts': 0,
                'attack_types': {},
                'threat_levels': {}
            })
        
        attack_types = {}
        threat_levels = {}
        
        for alert in ALERT_STORAGE:
            at = alert.get('prediction', 'unknown')
            tl = alert.get('severity', 'Low')
            
            attack_types[at] = attack_types.get(at, 0) + 1
            threat_levels[tl] = threat_levels.get(tl, 0) + 1
        
        return jsonify({
            'total_alerts': len(ALERT_STORAGE),
            'attack_types': attack_types,
            'threat_levels': threat_levels,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/simulate', methods=['POST'])
def simulate_attack():
    """
    Simulate a network attack for testing
    
    Request body (JSON):
    {
        "attack_type": "DDoS",  // optional, random if not specified
        "count": 10  // number of simulations
    }
    """
    try:
        data = request.get_json() or {}
        attack_type = data.get('attack_type', 'random')
        count = min(data.get('count', 1), 100)
        
        simulated_attacks = []
        
        attack_scenarios = {
            'DDoS': {'duration': 1000, 'count': 500, 'srv_count': 500, 'serror_rate': 1.0},
            'Probe': {'duration': 100, 'count': 50, 'srv_count': 20, 'serror_rate': 0.5},
            'R2L': {'duration': 50, 'count': 10, 'num_failed_logins': 5, 'logged_in': 1},
            'U2R': {'duration': 10, 'num_compromised': 1, 'root_shell': 1, 'su_attempted': 1},
            'Normal': {'duration': 100, 'logged_in': 1, 'count': 10}
        }
        
        for i in range(count):
            if attack_type == 'random':
                scenario = list(attack_scenarios.keys())[np.random.randint(0, len(attack_scenarios))]
            else:
                scenario = attack_type
            
            base_features = attack_scenarios.get(scenario, attack_scenarios['Normal'])
            
            features = {
                'duration': base_features.get('duration', 0) + np.random.randint(0, 100),
                'protocol_type': np.random.choice(['tcp', 'udp', 'icmp']),
                'service': np.random.choice(['http', 'ftp', 'dns', 'ssh']),
                'flag': np.random.choice(['SF', 'S0', 'REJ']),
                'src_bytes': np.random.randint(0, 10000),
                'dst_bytes': np.random.randint(0, 50000),
                'land': 0,
                'wrong_fragment': np.random.randint(0, 3),
                'urgent': 0,
                'hot': 0,
                'num_failed_logins': base_features.get('num_failed_logins', 0),
                'logged_in': base_features.get('logged_in', 0),
                'num_compromised': base_features.get('num_compromised', 0),
                'root_shell': base_features.get('root_shell', 0),
                'su_attempted': base_features.get('su_attempted', 0),
                'num_root': 0,
                'num_file_creations': 0,
                'num_shells': 0,
                'num_access_files': 0,
                'is_guest_login': 0,
                'count': base_features.get('count', 0),
                'srv_count': base_features.get('srv_count', 0),
                'serror_rate': base_features.get('serror_rate', 0),
                'srv_serror_rate': base_features.get('serror_rate', 0),
                'rerror_rate': 0,
                'srv_rerror_rate': 0,
                'same_srv_rate': 0.5,
                'diff_srv_rate': 0.1,
                'srv_diff_host_rate': 0.1,
                'dst_host_count': 50,
                'dst_host_srv_count': 50,
                'dst_host_same_srv_rate': 0.5,
                'dst_host_diff_srv_rate': 0.1,
                'dst_host_same_src_port_rate': 0.5,
                'dst_host_serror_rate': base_features.get('serror_rate', 0),
                'dst_host_srv_serror_rate': base_features.get('serror_rate', 0),
                'dst_host_rerror_rate': 0,
                'dst_host_srv_rerror_rate': 0
            }
            
            processed = preprocess_input(features)
            prediction = MODEL.predict(processed)[0]
            probabilities = MODEL.predict_proba(processed)[0]
            attack_info, threat_level = get_attack_info(prediction)
            
            simulated_attacks.append({
                'simulation_id': i + 1,
                'scenario': scenario,
                'prediction': str(prediction),
                'attack_type': attack_info,
                'threat_level': threat_level,
                'confidence': round(float(max(probabilities)), 4)
            })
            
            if attack_info != 'Normal':
                alert = {
                    'id': f"sim_{len(ALERT_STORAGE) + 1}",
                    'severity': threat_level,
                    'title': f"Simulated {attack_info} Attack",
                    'prediction': prediction,
                    'confidence': float(max(probabilities)),
                    'timestamp': datetime.utcnow().isoformat(),
                    'simulated': True
                }
                ALERT_STORAGE.append(alert)
        
        return jsonify({
            'simulations': simulated_attacks,
            'count': count
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    load_model()
    app.run(host='0.0.0.0', port=5001, debug=True)