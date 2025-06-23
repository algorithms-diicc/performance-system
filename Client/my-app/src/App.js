import React, { Component } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RenderForm from "./screens/RenderForm";
import RenderImage from "./screens/RenderImage";
import Navbar from "./common/Navbar";
import TaskPage from "./screens/TaskPage";
import RenderDoubleForm from "./screens/RenderDobuleForm";

class App extends Component {
  state = {
    tasksState: {
      lcs: false,
      camm: false
      // ... Add more tasks as needed.
    }
  }

  handleTaskToggle = (taskId, value) => {
    this.setState(prevState => ({
      tasksState: {
        ...prevState.tasksState,
        [taskId]: value
      }
    }));
  }

  componentDidMount() {
    document.title = "Performace System";
  }

  render() {
    return (
      <div>
        <BrowserRouter>
          <Navbar tasksState={this.state.tasksState} />
          <Routes>
            <Route path="/taskpage" element={<TaskPage onTaskToggle={this.handleTaskToggle} tasksState={this.state.tasksState} />} />
            {/* <Route path="/" element={<RenderForm tasksState={this.state.tasksState} />} /> */}
            <Route path="/" element={<RenderForm />} />
            <Route path="/compare" element={<RenderDoubleForm tasksState={this.state.tasksState} />} />
            <Route path="/code/:codename" element={<RenderImage />} />
          </Routes>
        </BrowserRouter>
      </div>
    );
  }
}

export default App;
