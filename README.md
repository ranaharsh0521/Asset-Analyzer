# AI-Driven Cyber-Attack Prediction Using Temporal GNNs

This research prototype demonstrates a Temporal Graph Neural Network (TGNN) approach to intrusion detection and attack stage prediction.

## 🚀 Quick Start (Local Host)

Follow these steps to run the project on your local machine:

### 1. Prerequisites
- **Node.js** (v20 or higher)
- **npm** (comes with Node.js)

### 2. Setup
Download the project ZIP from Replit and extract it. Open your terminal in the project folder.

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Locally
Execute the following command to start the frontend dashboard:
```bash
npm run dev:client
```

### 5. Access the Dashboard
Once the server starts, open your browser and navigate to:
**[http://localhost:5000](http://localhost:5000)**

---

## 🛠 Project Structure
- `client/src/pages/`: All 8 research dashboards (SOC, Risk, Evaluation, etc.)
- `client/src/components/viz/`: Custom HTML5 Canvas and Recharts visualizations.
- `client/src/lib/advancedMockData.ts`: Synthetic intelligence datasets for demonstration.

## 🔬 Key Features
- **Temporal Graph Visualization**: Real-time simulation of network traffic nodes.
- **Attack Intelligence**: Prediction of attack stages from Reconnaissance to Exfiltration.
- **Explainability**: Heatmaps showing GNN attention weights for security analyst review.
- **Early Detection**: Comparison metrics showing gain over traditional IDS.
