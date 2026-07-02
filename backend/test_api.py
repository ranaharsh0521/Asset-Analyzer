"""
Example API requests and responses for the Cyber Attack Prediction System
Run this after starting the backend server
"""

import requests
import json
import time

BASE_URL = "http://localhost:5001"

SAMPLE_NETWORK_DATA = {
    "duration": 0,
    "protocol_type": "tcp",
    "service": "http",
    "flag": "SF",
    "src_bytes": 200,
    "dst_bytes": 1000,
    "land": 0,
    "wrong_fragment": 0,
    "urgent": 0,
    "hot": 0,
    "num_failed_logins": 0,
    "logged_in": 0,
    "num_compromised": 0,
    "root_shell": 0,
    "su_attempted": 0,
    "num_root": 0,
    "num_file_creations": 0,
    "num_shells": 0,
    "num_access_files": 0,
    "is_guest_login": 0,
    "count": 10,
    "srv_count": 10,
    "serror_rate": 0.0,
    "srv_serror_rate": 0.0,
    "rerror_rate": 0.0,
    "srv_rerror_rate": 0.0,
    "same_srv_rate": 0.5,
    "diff_srv_rate": 0.1,
    "srv_diff_host_rate": 0.1,
    "dst_host_count": 50,
    "dst_host_srv_count": 50,
    "dst_host_same_srv_rate": 0.5,
    "dst_host_diff_srv_rate": 0.1,
    "dst_host_same_src_port_rate": 0.5,
    "dst_host_serror_rate": 0.0,
    "dst_host_srv_serror_rate": 0.0,
    "dst_host_rerror_rate": 0.0,
    "dst_host_srv_rerror_rate": 0.0
}

DDOS_ATTACK_DATA = {
    "duration": 1000,
    "protocol_type": "tcp",
    "service": "http",
    "flag": "S0",
    "src_bytes": 10000,
    "dst_bytes": 0,
    "land": 0,
    "wrong_fragment": 0,
    "urgent": 0,
    "hot": 0,
    "num_failed_logins": 0,
    "logged_in": 0,
    "num_compromised": 0,
    "root_shell": 0,
    "su_attempted": 0,
    "num_root": 0,
    "num_file_creations": 0,
    "num_shells": 0,
    "num_access_files": 0,
    "is_guest_login": 0,
    "count": 500,
    "srv_count": 500,
    "serror_rate": 1.0,
    "srv_serror_rate": 1.0,
    "rerror_rate": 0.0,
    "srv_rerror_rate": 0.0,
    "same_srv_rate": 0.0,
    "diff_srv_rate": 0.0,
    "srv_diff_host_rate": 0.0,
    "dst_host_count": 255,
    "dst_host_srv_count": 255,
    "dst_host_same_srv_rate": 0.0,
    "dst_host_diff_srv_rate": 0.0,
    "dst_host_same_src_port_rate": 0.0,
    "dst_host_serror_rate": 1.0,
    "dst_host_srv_serror_rate": 1.0,
    "dst_host_rerror_rate": 0.0,
    "dst_host_srv_rerror_rate": 0.0
}

PROBE_ATTACK_DATA = {
    "duration": 100,
    "protocol_type": "tcp",
    "service": "http",
    "flag": "REJ",
    "src_bytes": 500,
    "dst_bytes": 100,
    "land": 0,
    "wrong_fragment": 0,
    "urgent": 0,
    "hot": 0,
    "num_failed_logins": 0,
    "logged_in": 0,
    "num_compromised": 0,
    "root_shell": 0,
    "su_attempted": 0,
    "num_root": 0,
    "num_file_creations": 0,
    "num_shells": 0,
    "num_access_files": 0,
    "is_guest_login": 0,
    "count": 50,
    "srv_count": 20,
    "serror_rate": 0.5,
    "srv_serror_rate": 0.5,
    "rerror_rate": 0.3,
    "srv_rerror_rate": 0.3,
    "same_srv_rate": 0.2,
    "diff_srv_rate": 0.8,
    "srv_diff_host_rate": 0.8,
    "dst_host_count": 100,
    "dst_host_srv_count": 10,
    "dst_host_same_srv_rate": 0.1,
    "dst_host_diff_srv_rate": 0.9,
    "dst_host_same_src_port_rate": 0.1,
    "dst_host_serror_rate": 0.5,
    "dst_host_srv_serror_rate": 0.5,
    "dst_host_rerror_rate": 0.3,
    "dst_host_srv_rerror_rate": 0.3
}


def test_health():
    """Test health check endpoint"""
    print("\n=== Health Check ===")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


def test_predict(data, description):
    """Test prediction endpoint"""
    print(f"\n=== {description} ===")
    print(f"Data: {json.dumps(data, indent=2)}")
    response = requests.post(f"{BASE_URL}/predict", json=data)
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response: {json.dumps(result, indent=2)}")
    return result


def test_alerts():
    """Test alerts endpoint"""
    print("\n=== Get Alerts ===")
    response = requests.get(f"{BASE_URL}/alerts?limit=10")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


def test_statistics():
    """Test statistics endpoint"""
    print("\n=== Get Statistics ===")
    response = requests.get(f"{BASE_URL}/statistics")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


def test_simulate():
    """Test simulation endpoint"""
    print("\n=== Simulate Attack ===")
    response = requests.post(f"{BASE_URL}/simulate", json={"count": 5})
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


def test_batch_predict():
    """Test batch prediction"""
    print("\n=== Batch Prediction ===")
    data = {"records": [SAMPLE_NETWORK_DATA, DDOS_ATTACK_DATA, PROBE_ATTACK_DATA]}
    response = requests.post(f"{BASE_URL}/predict/batch", json=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json()


def main():
    print("="*60)
    print("Cyber Attack Prediction API - Test Examples")
    print("="*60)
    
    try:
        health = test_health()
        
        if health.get('model_loaded'):
            test_predict(SAMPLE_NETWORK_DATA, "Normal Traffic Prediction")
            test_predict(DDOS_ATTACK_DATA, "DDoS Attack Prediction")
            test_predict(PROBE_ATTACK_DATA, "Probe Attack Prediction")
            test_batch_predict()
            test_simulate()
            time.sleep(1)
            test_alerts()
            test_statistics()
        else:
            print("\nModel not loaded. Please run training first.")
            
    except requests.exceptions.ConnectionError:
        print(f"\nError: Cannot connect to {BASE_URL}")
        print("Make sure the Flask server is running: python app.py")
    except Exception as e:
        print(f"\nError: {e}")


if __name__ == '__main__':
    main()