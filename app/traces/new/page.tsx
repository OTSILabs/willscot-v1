"use client";

import { FileProcessingForm } from "@/components/common/file-processing-form";
import { PageContainers } from "@/components/page-containers";
import { PageDescriptiveSection } from "@/components/typography";
import { PageTitle } from "@/components/typography";
import { PageSubdescription } from "@/components/typography";
import { BackButton } from "@/components/back-button";

export default function NewTracePage() {
  return (
    <PageContainers>
      <div className="flex items-center -mb-2">
        <BackButton label="Back to Traces" />
      </div>

      <PageDescriptiveSection>
        <PageTitle title="New Video" />
        <PageSubdescription subdescription="Upload a new video to S3." />
      </PageDescriptiveSection>
      <FileProcessingForm />
    </PageContainers>
  );
}
