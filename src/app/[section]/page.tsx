import { Suspense } from "react";
import LifeOSApp from "../lifeos-app";

export default function SectionPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "24px" }}>
          Loading LifeOS...
        </div>
      }
    >
      <LifeOSApp />
    </Suspense>
  );
}