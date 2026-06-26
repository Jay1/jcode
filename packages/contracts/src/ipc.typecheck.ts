import type { FirstRunState } from "./firstRunWizard";
import type { NativeApi } from "./ipc";

type Assert<T extends true> = T;

type IsExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;

type CompleteFirstRunWizardReturn = Awaited<
  ReturnType<NativeApi["server"]["completeFirstRunWizard"]>
>;

type SkipFirstRunWizardReturn = Awaited<ReturnType<NativeApi["server"]["skipFirstRun"]>>;

export type _CompleteFirstRunWizardReturnsState = Assert<
  IsExact<CompleteFirstRunWizardReturn, FirstRunState>
>;

export type _SkipFirstRunWizardReturnsState = Assert<
  IsExact<SkipFirstRunWizardReturn, FirstRunState>
>;
