import React, { Component } from "react";
import axios from "axios";

class RenderTable extends Component {
  constructor(props){
    super(props);
    this.state={
      EnergyCores: '',
      EnergyPkg: '',
      EnergyRAM: '', 
      Instructions: '', 
      LLCLoads: '',
      LLCLoadMisses: '',
      LLCStores: '',
      LLCStoresMisses: '',
      L1DcacheLoads: '',
      L1DcacheLoadMisses: '',
      L1DcacheStores: '',
      CacheMisses: '',
      CacheReferences: '',
      Branches: '',
      BranchMisses: '', 
      CpuCycles: '',
      DurationTime: '',
      PowerCores : '',
      PowerPkg: '',
      PowerRAM: ''}
  }

  componentDidMount(){
    axios({
      url: 'http://127.0.0.1:5000/'+this.props.code+'/mean',
        method: 'GET'
      })
    .then((response) => {
      this.setState(response.data)
      this.setState({
        BranchMisses: response.data['Branch-Misses']
      })
    });
  }

  render(){
    return(
      <React.Fragment>
        <div>
          <table style={{width: "50%"} }>
            <tbody>
              <tr>
                <td className="dataName">Energía de Nucleos (J):</td>
                <td>{this.state.EnergyCores}</td>
                <td className="dataName">Energía de Paquete (J):</td>
                <td>{this.state.EnergyPkg}</td>
                <td className="dataName">Energía de RAM (J):</td>
                <td>{this.state.EnergyRAM}</td>
                <td className="dataName">Instrucciones:</td>
                <td>{this.state.Instructions}</td>
              </tr>
              <tr>
                <td className="dataName">Lecturas de caché último nivel:</td>
                <td>{this.state.LLCLoads}</td>
                <td className="dataName">Fallos de caché último nivel:</td>
                <td>{this.state.LLCLoadMisses}</td>
                <td className="dataName">Escrituras de caché último nivel:</td>
                <td>{this.state.LLCStores}</td>
                <td className="dataName">Fallos de escrituras de caché último nivel:</td>
                <td>{this.state.LLCStoresMisses}</td>
              </tr>
              <tr>
                <td className="dataName">Lecturas de caché nivel 1:</td>
                <td>{this.state.L1DcacheLoads}</td>
                <td className="dataName">Fallos de caché nivel 1:</td>
                <td>{this.state.L1DcacheLoadMisses}</td>
                <td className="dataName">Escrituras de caché nivel 1:</td>
                <td>{this.state.L1DcacheStores}</td>
                <td className="dataName">Fallos generales de caché:</td>
                <td>{this.state.CacheMisses}</td>
              </tr>
              <tr>
                <td className="dataName">Referencias de caché:</td>
                <td>{this.state.CacheReferences}</td>
                <td className="dataName">Saltos:</td>
                <td>{this.state.Branches}</td>
                <td className="dataName">Fallos de saltos:</td>
                <td>{this.state.BranchMisses}</td>
                <td className="dataName">Ciclos de CPU:</td>
                <td>{this.state.CpuCycles}</td>
              </tr>
              <tr>
                <td className="dataName">Tiempo de ejecución (ns):</td>
                <td>{this.state.DurationTime}</td>
                <td className="dataName">Potencia de Núcleos (W):</td>
                <td>{this.state.PowerCores}</td>
                <td className="dataName">Potencia de Paquete (W):</td>
                <td>{this.state.PowerPkg}</td>
                <td className="dataName">Potencia de RAM (W):</td>
                <td>{this.state.PowerRAM}</td>
              </tr>
            </tbody>
          </table>
         
        </div>
      </React.Fragment>
    )
  }
}

export default RenderTable;
