# import pandas as pd
# import plotly.graph_objects as go
# import numpy as np
# import os


# def plotly_box_plot(data, name):
#     data.replace('<not-counted>', np.nan, inplace=True)

#     # Convert to float type
#     for col in data.columns:
#         data[col] = pd.to_numeric(data[col], errors='coerce')

#     data_columns = [col for col in data.columns if col != 'Increment']

#     for columni, col in enumerate(data_columns, 1):
#         medians = []

#         # Extract the box data for each increment
#         box_data = [data[data['Increment'] == increment][col].dropna().values for increment in data['Increment'].unique()]

#         # Create the box and whisker plot
#         fig = go.Figure()

#         for i, increment_data in enumerate(box_data):
#             # Each box is added separately to the figure
#             fig.add_trace(go.Box(y=increment_data, name=str(data['Increment'].unique()[i]), boxmean='sd', boxpoints='all', jitter=0.3, pointpos=-1.8))

#         # Title and labels
#         fig.update_layout(title=f"Box plot for {col}", xaxis_title="Increment", yaxis_title="Value")

#         # Save the plot as interactive HTML
#         output_directory = f"static/{name}"
#         os.makedirs(output_directory, exist_ok=True)
#         fig.write_html(f"{output_directory}/fig{columni}.html")


# # Sample usage
# df = pd.read_csv('../resultsEnergy2023-10-30-13:28:08.csv')
# plotly_box_plot(df, 'sample_name')
