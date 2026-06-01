import { Effect, ServiceMap } from "effect";
import type { ProjectIconMetadata } from "@jcode/contracts";

export interface ProjectLanguageIconResolverShape {
  readonly resolveMetadata: (cwd: string) => Effect.Effect<ProjectIconMetadata | null>;
}

export class ProjectLanguageIconResolver extends ServiceMap.Service<
  ProjectLanguageIconResolver,
  ProjectLanguageIconResolverShape
>()("jcode/project/Services/ProjectLanguageIconResolver") {}
