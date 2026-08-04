import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, Music2 } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Music2 className="h-8 w-8" />
        </div>
        <h1 className="mb-3 text-5xl font-bold tracking-tight">404</h1>
        <p className="mb-6 text-muted-foreground">
          We couldn't find <span className="text-foreground">{location.pathname}</span>. The track may have moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Home className="h-4 w-4" />
          Back to NYRA
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
