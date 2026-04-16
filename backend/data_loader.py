import pandas as pd
import os

def load_data():
    """
    Load dataset.csv, parse dates, filter returns, and aggregate daily demand per product.
    Returns:
        product_data: dict of {product_id (StockCode): DataFrame with 'date' and 'demand'}
    """
    # Assuming dataset.csv is in the same directory as this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, 'dataset.csv')
    
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")
        
    df = pd.read_csv(dataset_path)
    
    # Parse InvoiceDate as datetime
    df['InvoiceDate'] = pd.to_datetime(df['InvoiceDate'])
    
    # Filter out negative quantities (returns)
    df = df[df['Quantity'] > 0]
    
    # Extract date from datetime
    df['date'] = df['InvoiceDate'].dt.date
    
    # Aggregate: daily total Quantity per StockCode
    daily_demand = df.groupby(['StockCode', 'date'])['Quantity'].sum().reset_index()
    daily_demand.rename(columns={'Quantity': 'demand'}, inplace=True)
    
    # Dictionary mapping product_id to dataframe
    product_data = {}
    for stock_code, group in daily_demand.groupby('StockCode'):
        # Sort by date for time series consistency
        group = group.sort_values('date').reset_index(drop=True)
        # Convert date back to datetime for internal model code if requested, or keep as date. 
        # Using string here for ease of serialization later, or datetime object.
        group['date'] = pd.to_datetime(group['date'])
        product_data[str(stock_code)] = group[['date', 'demand']]
        
    return product_data

def get_product_list():
    """
    Returns top 20 products by total aggregated quantity with their descriptions.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, 'dataset.csv')
    
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")
        
    df = pd.read_csv(dataset_path, usecols=['StockCode', 'Description', 'Quantity'])
    
    # Filter negative quantities and empty descriptions
    df = df[df['Quantity'] > 0]
    df = df.dropna(subset=['Description'])
    
    # Aggregate total quantity per StockCode and get first Description
    grouped = df.groupby('StockCode').agg({'Quantity': 'sum', 'Description': 'first'}).reset_index()
    
    # Sort and get top 20
    top_20 = grouped.sort_values(by='Quantity', ascending=False).head(20)
    
    # return list of dicts
    return [{"id": str(row['StockCode']), "name": str(row['Description']).strip().title()} for _, row in top_20.iterrows()]
