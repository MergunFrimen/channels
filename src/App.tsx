import { Viewer } from "./Viewer";
import { Context } from "./context";

export function App() {
  const context = new Context();

  return (
    <div
      style={{
        inset: "100px 0px 0px 100px",
        position: "absolute",
        height: "500px",
        width: "500px",
      }}
    >
      <Viewer context={context} />
    </div>
  );
}
