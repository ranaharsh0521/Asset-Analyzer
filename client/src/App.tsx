import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Experiment from "@/pages/Experiment";
import Evaluation from "@/pages/Evaluation";
import ProjectStructure from "@/pages/ProjectStructure";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/experiment" component={Experiment} />
      <Route path="/evaluation" component={Evaluation} />
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
