import React from "react";
import SystemStatePage from "../screens/SystemStatePage";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      "Unhandled React render error:",
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <SystemStatePage
          statusCode="500"
          description="La interfaz encontró un error inesperado y no pudo continuar mostrando esta vista."
        />
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
