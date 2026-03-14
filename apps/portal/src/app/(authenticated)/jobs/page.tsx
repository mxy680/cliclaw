import { Header } from "@/components/layout/header";
import { JobsList } from "@/components/jobs/jobs-list";

export default function JobsPage() {
  return (
    <>
      <Header title="Jobs" />
      <div className="p-6">
        <JobsList />
      </div>
    </>
  );
}
