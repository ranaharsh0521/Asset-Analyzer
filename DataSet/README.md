# Datasets

Benchmark CSVs are not stored in git (they are large). Place files here before training.

## CICIDS2017

1. Download the MachineLearningCSV set from the [CICIDS2017 dataset page](https://www.unb.ca/cic/datasets/ids-2017.html).
2. Extract so this folder looks like:

```
DataSet/
  CICIDS2017/
    Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv
    Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv
    Friday-WorkingHours-Morning.pcap_ISCX.csv
    Monday-WorkingHours.pcap_ISCX.csv
    Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv
    Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv
    Tuesday-WorkingHours.pcap_ISCX.csv
    Wednesday-workingHours.pcap_ISCX.csv
```

3. Point the AI service at this directory:

```bash
export DATASET_ROOT=./DataSet
```

Optional extra datasets (UNSW-NB15, CSE-CIC-IDS2018) can sit beside `CICIDS2017/` using the same `DATASET_ROOT`.
