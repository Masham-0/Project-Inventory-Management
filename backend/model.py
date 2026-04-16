import pandas as pd
import numpy as np
import datetime
from sklearn.ensemble import RandomForestRegressor

def train_and_forecast(df):
    """
    Train a Random Forest model on product demand and forecast next 30 days.
    Input: DataFrame with 'date' and 'demand' columns.
    Returns: dict with 'forecast' (list of floats) and 'dates' (list of strings).
    """
    if len(df) == 0:
        return {"forecast": [0.0]*30, "dates": []}
        
    df = df.copy()
    df.sort_values('date', inplace=True)
    df.reset_index(drop=True, inplace=True)
    
    # Feature engineering
    for i in range(1, 8):
        df[f'lag_{i}'] = df['demand'].shift(i)
        
    df['rolling_mean_7'] = df['demand'].shift(1).rolling(window=7).mean()
    df['day_of_week'] = df['date'].dt.dayofweek
    df['month'] = df['date'].dt.month
    
    # Drop NaNs from shift and rolling operations
    df_features = df.dropna().copy()
    
    # If not enough data, return zeros
    if len(df_features) < 10:
        # Generate naive forecast (mean of whatever we have)
        mean_demand = df['demand'].mean() if len(df) > 0 else 0.0
        last_date = df['date'].max()
        future_dates = [(last_date + datetime.timedelta(days=i)).strftime('%Y-%m-%d') for i in range(1, 31)]
        return {"forecast": [float(mean_demand)]*30, "dates": future_dates}

    
    features = [f'lag_{i}' for i in range(1, 8)] + ['rolling_mean_7', 'day_of_week', 'month']
    X = df_features[features]
    y = df_features['demand']
    
    # Train test split (80% / 20% by time)
    split_idx = int(0.8 * len(df_features))
    
    X_train = X.iloc[:split_idx]
    y_train = y.iloc[:split_idx]
    
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Predict next 30 days iteratively
    forecast = []
    future_dates = []
    
    current_data = df_features.iloc[-1].copy()
    last_date = current_data['date']
    
    # History of demand to compute rolling mean and lags
    history = list(df_features['demand'].values)
    
    for i in range(1, 31):
        next_date = last_date + datetime.timedelta(days=i)
        
        # Prepare input vector
        lags = history[-7:]
        lags.reverse()  # index 0 is lag_1, index 6 is lag_7
        
        rolling_mean = np.mean(history[-7:])
        dow = next_date.dayofweek
        month = next_date.month
        
        x_pred = pd.DataFrame([lags + [rolling_mean, dow, month]], columns=features)
        pred_val = float(model.predict(x_pred)[0])
        pred_val = max(0.0, pred_val) # No negative demand
        
        forecast.append(pred_val)
        future_dates.append(next_date.strftime('%Y-%m-%d'))
        
        # update history
        history.append(pred_val)
        last_date = next_date
        
    return {"forecast": forecast, "dates": future_dates}
