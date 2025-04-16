def plot_common(columni, csvobj, ax, name):
    df = csvobj
    test = csvobj.iloc[:, columni]
    
    if columni < 3:
        ax2 = ax.twinx()
        test2 = csvobj.iloc[:, columni+17]
        ax.axhline(mean(test), label='Energia promedio', color='orange')
        ax2.axhline(mean(test2), label='Potencia promedio', color='purple')
        df.plot(y=columni, use_index=True, kind='bar', ax=ax, color='lightblue',
                ylabel=unidadesdemedida[columni], legend=None, xlabel='Iteraciones', title=titulos[columni])
        ax.set_ylim(top=max(test)+0.1, bottom=max(min(test)-0.1,0))
        df.plot(y=columni+17, use_index=True, kind='line', ax=ax2, color='red', ylabel='Watts', style='--', marker='.')
        lines, labels = ax.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax2.legend(lines + lines2, labels + labels2, loc='upper right')
        plt.xticks(np.arange(0,30, step=5))
    else:
        try:
            df.plot(
                y=columni, use_index=True, color=color[0], title=titulos[columni],
                legend=None, xlabel='Iteraciones',
                ylabel=unidadesdemedida[columni], style='--', marker='.', ax=ax, label="")
            ax.axhline(mean(test), label='Promedio', color='orange')
        except TypeError:
            print("err: ", TypeError)
    
    if columni > 3:
        plt.ticklabel_format(scilimits=[-5,5])
    plt.minorticks_on()
    plt.grid()
    if ax.lines:
        plt.savefig("static/" + name + "/fig" + str(columni) + ".svg", format='svg')

def plot_box(data, name):
    data.replace('<not-counted>', np.nan, inplace=True)
    
    # Use non-interactive backend
    plt.switch_backend('Agg')

    # Convert to float type
    for col in data.columns:
        data[col] = pd.to_numeric(data[col], errors='coerce')

    data_columns = [col for col in data.columns if col != 'Increment']

    for columni, col in enumerate(data_columns, 1):
        medians = []
        fig, ax = plt.subplots(figsize=(12, 8))

        # Extract the box data for each increment
        box_data = [data[data['Increment'] == increment][col].dropna().values for increment in data['Increment'].unique()]
        
        # Create the box and whisker plot
        boxes = ax.boxplot(box_data, whis=1.5, vert=True, patch_artist=True, medianprops=dict(color="black"))
        
        # Coloring the boxes
        for patch in boxes['boxes']:
            patch.set_facecolor('lightblue')
        
        # Median values
        for median in boxes['medians']:
            medians.append(median.get_ydata()[0])

        # Line connecting medians
        ax.plot(np.arange(1, len(data['Increment'].unique()) + 1), medians, color="red", label="Medians")
        
        # Grid
        ax.grid(True, which='both', linestyle='--', linewidth=0.5)
        
        # Title and labels
        ax.set_title(f"Box plot for {col}")
        ax.set_xlabel('Increment')
        ax.set_ylabel('Value')
        
        # Setting x ticks labels as Increment values
        ax.set_xticks(np.arange(1, len(data['Increment'].unique()) + 1))
        ax.set_xticklabels(data['Increment'].unique())

        # Save the plot
        plt.tight_layout()
        plt.savefig(f"static/{name}/fig{columni}.svg", format='svg')
        plt.close()  # close the figure to free up memory


def plot_box_plotly(data, name):
    # Replace non-numeric entries
    data.replace('<not-counted>', np.nan, inplace=True)

    # Convert columns to float type
    for col in data.columns:
        data[col] = pd.to_numeric(data[col], errors='coerce')

    data_columns = [col for col in data.columns if col != 'Increment']

    # Sort the data by 'Increment' to ensure the order on the x-axis
    data.sort_values(by='Increment', inplace=True)

    for columni, col in enumerate(data_columns, 1):
        # Create a new figure
        fig = go.Figure()

        # Extract the box data for each increment
        box_data = [data[data['Increment'] == increment][col].dropna().values for increment in data['Increment'].unique()]

        # Create the box traces
        for i, increment in enumerate(data['Increment'].unique(), 1):
            fig.add_trace(go.Box(y=box_data[i-1], name=str(increment), marker_color='lightblue', line_color='black'))

        # Median trace
        medians = [np.median(b_data) for b_data in box_data if len(b_data) > 0]
        fig.add_trace(go.Scatter(x=list(data['Increment'].unique()), y=medians, mode='lines', name='Medians', line=dict(color='red')))

        # Adjust layout
        fig.update_layout(
            title=f"Box plot for {col}",
            xaxis_title='Increment',
            yaxis_title='Value',
        )

        # Save the plot as HTML
        fig.write_html(f"static/{name}/fig{columni}.html")  