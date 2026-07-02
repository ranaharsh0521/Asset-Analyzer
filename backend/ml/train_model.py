"""
Cyber Attack Detection Model Training
Using NSL-KDD Dataset with Random Forest Classifier
"""

import pandas as pd
import numpy as np
import pickle
import os
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import warnings
warnings.filterwarnings('ignore')

DATASET_URL = "https://raw.githubusercontent.com/Defect17/NSL-KDD-KDDcup99/master/KDDTrain%2B.csv"
OUTPUT_DIR = os.path.dirname(__file__)

COLUMNS = [
    'duration', 'protocol_type', 'service', 'flag', 'src_bytes', 'dst_bytes',
    'land', 'wrong_fragment', 'urgent', 'hot', 'num_failed_logins', 'logged_in',
    'num_compromised', 'root_shell', 'su_attempted', 'num_root', 'num_file_creations',
    'num_shells', 'num_access_files', 'is_guest_login', 'count', 'srv_count',
    'serror_rate', 'srv_serror_rate', 'rerror_rate', 'srv_rerror_rate',
    'same_srv_rate', 'diff_srv_rate', 'srv_diff_host_rate', 'dst_host_count',
    'dst_host_srv_count', 'dst_host_same_srv_rate', 'dst_host_diff_srv_rate',
    'dst_host_same_src_port_rate', 'dst_host_serror_rate', 'dst_host_srv_serror_rate',
    'dst_host_rerror_rate', 'dst_host_srv_rerror_rate', 'label'
]

ATTACK_TYPES = {
    'normal': 'normal',
    'neptune': 'DDoS', 'back': 'DDoS', 'land': 'DDoS', 'pod': 'DDoS',
    'teardrop': 'DDoS', 'smurf': 'DDoS', 'mailbomb': 'DDoS', 'apache2': 'DDoS',
    'processtable': 'DDoS', 'udpstorm': 'DDoS',
    'satan': 'Probe', 'ipsweep': 'Probe', 'nmap': 'Probe', 'portsweep': 'Probe',
    'mscan': 'Probe', 'saint': 'Probe',
    'guess_passwd': 'R2L', 'ftp_write': 'R2L', 'imap': 'R2L', 'multihop': 'R2L',
    'phf': 'R2L', 'spy': 'R2L', 'warezclient': 'R2L', 'warezmaster': 'R2L',
    'sendmail': 'R2L', 'named': 'R2L', 'snmpgetattack': 'R2L', 'snmpguess': 'R2L',
    'xlock': 'R2L', 'xsnoop': 'R2L', 'worm': 'R2L',
    'buffer_overflow': 'U2R', 'loadmodule': 'U2R', 'perl': 'U2R', 'rootkit': 'U2R',
    'httptunnel': 'U2R', 'ps': 'U2R', 'sqlattack': 'U2R', 'xterm': 'U2R'
}

THREAT_LEVELS = {
    'normal': 'Low',
    'DDoS': 'High',
    'Probe': 'Medium',
    'R2L': 'High',
    'U2R': 'High'
}


def download_dataset():
    """Download NSL-KDD dataset"""
    print("Downloading NSL-KDD dataset...")
    try:
        df = pd.read_csv(DATASET_URL, header=None, names=COLUMNS)
        print(f"Dataset downloaded: {len(df)} records")
        return df
    except Exception as e:
        print(f"Download failed: {e}")
        print("Using synthetic dataset for demonstration...")
        return create_synthetic_data()


def create_synthetic_data():
    """Create synthetic NSL-KDD style data for training"""
    np.random.seed(42)
    n_samples = 50000
    
    protocols = ['tcp', 'udp', 'icmp']
    services = ['http', 'ftp', 'smtp', 'dns', 'ssh', 'telnet', 'domain', 'auth', 
                'ftp_data', 'echo', 'discard', 'daytime', 'shell', 'login']
    flags = ['SF', 'S0', 'REJ', 'RSTO', 'RSTOS0', 'SH', 'S1', 'S2', 'S3', 'SHR']
    
    labels = ['normal'] * int(n_samples * 0.6) + \
             ['neptune'] * int(n_samples * 0.15) + \
             ['satan'] * int(n_samples * 0.08) + \
             ['ipsweep'] * int(n_samples * 0.05) + \
             ['portsweep'] * int(n_samples * 0.05) + \
             ['guess_passwd'] * int(n_samples * 0.03) + \
             ['buffer_overflow'] * int(n_samples * 0.02) + \
             ['teardrop'] * int(n_samples * 0.02)
    
    data = {
        'duration': np.random.randint(0, 10000, n_samples),
        'protocol_type': np.random.choice(protocols, n_samples),
        'service': np.random.choice(services, n_samples),
        'flag': np.random.choice(flags, n_samples),
        'src_bytes': np.random.randint(0, 1000000, n_samples),
        'dst_bytes': np.random.randint(0, 1000000, n_samples),
        'land': np.zeros(n_samples, dtype=int),
        'wrong_fragment': np.random.randint(0, 3, n_samples),
        'urgent': np.zeros(n_samples, dtype=int),
        'hot': np.random.randint(0, 10, n_samples),
        'num_failed_logins': np.random.randint(0, 5, n_samples),
        'logged_in': np.random.randint(0, 2, n_samples),
        'num_compromised': np.random.randint(0, 10, n_samples),
        'root_shell': np.zeros(n_samples, dtype=int),
        'su_attempted': np.zeros(n_samples, dtype=int),
        'num_root': np.random.randint(0, 10, n_samples),
        'num_file_creations': np.random.randint(0, 10, n_samples),
        'num_shells': np.random.randint(0, 5, n_samples),
        'num_access_files': np.random.randint(0, 5, n_samples),
        'is_guest_login': np.random.randint(0, 2, n_samples),
        'count': np.random.randint(0, 500, n_samples),
        'srv_count': np.random.randint(0, 500, n_samples),
        'serror_rate': np.random.uniform(0, 1, n_samples),
        'srv_serror_rate': np.random.uniform(0, 1, n_samples),
        'rerror_rate': np.random.uniform(0, 1, n_samples),
        'srv_rerror_rate': np.random.uniform(0, 1, n_samples),
        'same_srv_rate': np.random.uniform(0, 1, n_samples),
        'diff_srv_rate': np.random.uniform(0, 1, n_samples),
        'srv_diff_host_rate': np.random.uniform(0, 1, n_samples),
        'dst_host_count': np.random.randint(0, 255, n_samples),
        'dst_host_srv_count': np.random.randint(0, 255, n_samples),
        'dst_host_same_srv_rate': np.random.uniform(0, 1, n_samples),
        'dst_host_diff_srv_rate': np.random.uniform(0, 1, n_samples),
        'dst_host_same_src_port_rate': np.random.uniform(0, 1, n_samples),
        'dst_host_serror_rate': np.random.uniform(0, 1, n_samples),
        'dst_host_srv_serror_rate': np.random.uniform(0, 1, n_samples),
        'dst_host_rerror_rate': np.random.uniform(0, 1, n_samples),
        'dst_host_srv_rerror_rate': np.random.uniform(0, 1, n_samples),
        'label': labels[:n_samples]
    }
    
    df = pd.DataFrame(data)
    print(f"Synthetic dataset created: {len(df)} records")
    return df


def preprocess_data(df):
    """Preprocess the dataset"""
    print("Preprocessing data...")
    
    df['attack_category'] = df['label'].map(
        lambda x: ATTACK_TYPES.get(x, 'Probe')
    )
    
    protocol_encoder = LabelEncoder()
    service_encoder = LabelEncoder()
    flag_encoder = LabelEncoder()
    label_encoder = LabelEncoder()
    category_encoder = LabelEncoder()
    
    df['protocol_type'] = protocol_encoder.fit_transform(df['protocol_type'])
    df['service'] = service_encoder.fit_transform(df['service'])
    df['flag'] = flag_encoder.fit_transform(df['flag'])
    df['label_encoded'] = label_encoder.fit_transform(df['label'])
    df['category_encoded'] = category_encoder.fit_transform(df['attack_category'])
    
    feature_cols = [col for col in df.columns if col not in ['label', 'attack_category', 'label_encoded', 'category_encoded']]
    X = df[feature_cols]
    y = df['label']
    y_category = df['attack_category']
    
    print(f"Features shape: {X.shape}")
    print(f"Unique labels: {len(label_encoder.classes_)}")
    print(f"Attack categories: {category_encoder.classes_}")
    
    return X, y, y_category, label_encoder, category_encoder, feature_cols


def train_model(X_train, y_train):
    """Train Random Forest model"""
    print("\nTraining Random Forest model...")
    
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=20,
        min_samples_split=5,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
        class_weight='balanced'
    )
    
    model.fit(X_train, y_train)
    
    return model


def evaluate_model(model, X_test, y_test):
    """Evaluate model performance"""
    print("\nEvaluating model...")
    
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\nAccuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    return accuracy, y_pred


def save_model(model, scaler, label_encoder, feature_cols):
    """Save trained model and encoders"""
    print("\nSaving model...")
    
    models_dir = os.path.join(OUTPUT_DIR, 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    model_path = os.path.join(models_dir, 'attack_model.pkl')
    scaler_path = os.path.join(models_dir, 'scaler.pkl')
    encoder_path = os.path.join(models_dir, 'label_encoder.pkl')
    features_path = os.path.join(models_dir, 'feature_cols.pkl')
    
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"Model saved to: {model_path}")
    
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    print(f"Scaler saved to: {scaler_path}")
    
    with open(encoder_path, 'wb') as f:
        pickle.dump(label_encoder, f)
    print(f"Label encoder saved to: {encoder_path}")
    
    with open(features_path, 'wb') as f:
        pickle.dump(feature_cols, f)
    print(f"Feature columns saved to: {features_path}")
    
    print("\nModel training complete!")
    return model_path, scaler_path


def get_feature_importance(model, feature_cols):
    """Get and display feature importance"""
    importance = model.feature_importances_
    feature_importance = sorted(zip(feature_cols, importance), key=lambda x: x[1], reverse=True)
    
    print("\nTop 15 Most Important Features:")
    for i, (feature, imp) in enumerate(feature_importance[:15]):
        print(f"  {i+1}. {feature}: {imp:.4f}")
    
    return feature_importance


def main():
    """Main training pipeline"""
    print("="*60)
    print("Cyber Attack Detection Model Training")
    print("Using NSL-KDD Dataset")
    print("="*60)
    
    df = download_dataset()
    
    X, y, y_category, label_encoder, category_encoder, feature_cols = preprocess_data(df)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print(f"\nTraining set: {X_train_scaled.shape[0]} samples")
    print(f"Test set: {X_test_scaled.shape[0]} samples")
    
    model = train_model(X_train_scaled, y_train)
    
    accuracy, y_pred = evaluate_model(model, X_test_scaled, y_test)
    
    get_feature_importance(model, feature_cols)
    
    save_model(model, scaler, label_encoder, feature_cols)
    
    print("\n" + "="*60)
    print("Training completed successfully!")
    print("="*60)
    
    print("\nExample prediction:")
    sample = X_test_scaled[0:1]
    prediction = model.predict(sample)[0]
    proba = model.predict_proba(sample)[0]
    print(f"  Input: {X_test.iloc[0][:5].to_dict()}...")
    print(f"  Prediction: {prediction}")
    print(f"  Confidence: {max(proba):.4f}")


if __name__ == '__main__':
    main()