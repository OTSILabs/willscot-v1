"use client";

import { FileProcessingForm } from "@/components/common/file-processing-form";
import { PageContainers } from "@/components/page-containers";
import { PageDescriptiveSection } from "@/components/typography";
import { PageTitle } from "@/components/typography";
import { PageSubdescription } from "@/components/typography";

export default function NewTracePage() {
  return (
    <PageContainers>
      <PageDescriptiveSection>
        <PageTitle title="New Video" />
        <PageSubdescription subdescription="Upload a new video to S3." />
      </PageDescriptiveSection>
      <FileProcessingForm />
    </PageContainers>
  );
}
