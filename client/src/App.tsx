import { useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Experiment from "@/pages/Experiment";
import Evaluation from "@/pages/Evaluation";
import ProjectStructure from "@/pages/ProjectStructure";
import AttackIntelligence from "@/pages/AttackIntelligence";
import Explainability from "@/pages/Explainability";
import RiskAssessment from "@/pages/RiskAssessment";
import AdvancedEvaluation from "@/pages/AdvancedEvaluation";
import NetworkScanner from "@/pages/NetworkScanner";
import { clearRememberedUser } from "@/lib/localAuth";

function Router() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("gnn-ids-auth") === "true";
  });

  const handleLogin = () => {
    localStorage.setItem("gnn-ids-auth", "true");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("gnn-ids-auth");
    clearRememberedUser();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login">
          <Login onLogin={handleLogin} />
        </Route>
        <Route path="/">
          <Redirect to="/login" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        <Redirect to="/" />
      </Route>
      <Route path="/">
        <Dashboard onLogout={handleLogout} />
      </Route>
      <Route path="/experiment" component={Experiment} />
      <Route path="/evaluation" component={Evaluation} />
      <Route path="/attack-intelligence" component={AttackIntelligence} />
      <Route path="/explainability" component={Explainability} />
      <Route path="/risk-assessment" component={RiskAssessment} />
      <Route path="/advanced-eval" component={AdvancedEvaluation} />
      <Route path="/network-scanner" component={NetworkScanner} />
      <Route path="/files" component={ProjectStructure} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
