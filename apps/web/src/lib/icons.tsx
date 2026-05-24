import { type FC, type SVGProps } from "react";
import { PiGitCommit, PiSquareSplitHorizontal, PiSquareSplitVertical } from "react-icons/pi";
import { RiApps2Line } from "react-icons/ri";
import { SiGithub } from "react-icons/si";
import { VscMcp } from "react-icons/vsc";
import { LuSplit } from "react-icons/lu";
import { TbArrowsRightLeft } from "react-icons/tb";
import {
  IconAdjustments,
  IconAlertCircle,
  IconAlertTriangle,
  IconArchive,
  IconArrowBackUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconBell,
  IconBolt,
  IconBrain,
  IconBug,
  IconCamera,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconColumns2,
  IconCopy,
  IconDots,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFile,
  IconFlag,
  IconFlask2,
  IconFolder,
  IconGitCompare,
  IconGitPullRequest,
  IconEdit,
  IconInfoCircle,
  IconLayoutSidebarRightCollapse,
  IconLayoutDistributeHorizontal,
  IconListCheck,
  IconListDetails,
  IconLoader2,
  IconMaximize,
  IconMinimize,
  IconDeviceLaptop,
  IconMessageCircle,
  IconMicrophone,
  IconMoon,
  IconPalette,
  IconPaperclip,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconRotate2,
  IconSearch,
  IconSelector,
  IconSettings,
  IconStar,
  IconStarFilled,
  IconSun,
  IconTerminal,
  IconTerminal2,
  IconTextWrap,
  IconTool,
  IconTrash,
  IconWorld,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";

// Keep the existing icon API stable while the app moves from Lucide to Tabler.
export type LucideIcon = FC<SVGProps<SVGSVGElement>>;

function adaptIcon(Component: TablerIcon): LucideIcon {
  return function AdaptedIcon(props) {
    return <Component {...(props as any)} />;
  };
}

export const AppsIcon: LucideIcon = (props) => (
  <RiApps2Line className={props.className} style={props.style} />
);
export const QueueArrow: LucideIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M3.75 5.75V15.25C3.75 16.35 4.65 17.25 5.75 17.25H19.25" />
    <path d="M18 19V15.5L20.25 17.25L18 19Z" />
    <path d="M8.25 7.25H16.75" />
    <path d="M8.25 12.25H13.25" />
  </svg>
);
export const ArrowLeftIcon = adaptIcon(IconArrowLeft);
export const BellIcon = adaptIcon(IconBell);
export const ArrowRightIcon = adaptIcon(IconArrowRight);
export const ArrowDownIcon = adaptIcon(IconArrowDown);
export const ArrowUpIcon = adaptIcon(IconArrowUp);
export const BotIcon = adaptIcon(IconRobot);
export const BugIcon = adaptIcon(IconBug);
export const CameraIcon = adaptIcon(IconCamera);
export const CheckIcon = adaptIcon(IconCheck);
export const ChevronDownIcon = adaptIcon(IconChevronDown);
export const ChevronLeftIcon = adaptIcon(IconChevronLeft);
export const ChevronRightIcon = adaptIcon(IconChevronRight);
export const ChevronUpIcon = adaptIcon(IconChevronUp);
export const ChevronsUpDownIcon = adaptIcon(IconSelector);
export const CircleAlertIcon = adaptIcon(IconAlertCircle);
export const CircleCheckIcon = adaptIcon(IconCircleCheck);
export const Columns2Icon = adaptIcon(IconColumns2);
export const CopyIcon = adaptIcon(IconCopy);
export const DiffIcon = adaptIcon(IconGitCompare);
export const DownloadIcon = adaptIcon(IconDownload);
export const EllipsisIcon = adaptIcon(IconDots);
export const ExternalLinkIcon = adaptIcon(IconExternalLink);
export const EyeIcon = adaptIcon(IconEye);
export const PaletteIcon = adaptIcon(IconPalette);
export const PaperclipIcon = adaptIcon(IconPaperclip);
export const AdjustmentsIcon = adaptIcon(IconAdjustments);
export const ArchiveIcon = adaptIcon(IconArchive);
export const BrainIcon = adaptIcon(IconBrain);
export const FileIcon = adaptIcon(IconFile);
export const FlagIcon = adaptIcon(IconFlag);
export const FlaskConicalIcon = adaptIcon(IconFlask2);
export const FolderClosedIcon = adaptIcon(IconFolder);
export const FolderIcon = adaptIcon(IconFolder);
export const GitCommitIcon: LucideIcon = (props) => (
  <PiGitCommit className={props.className} style={props.style} />
);
export const GitHubIcon: LucideIcon = (props) => (
  <SiGithub className={props.className} style={props.style} />
);
export const GitPullRequestIcon = adaptIcon(IconGitPullRequest);
export const GlobeIcon = adaptIcon(IconWorld);
export const McpIcon: LucideIcon = (props) => (
  <VscMcp className={props.className} style={props.style} />
);
export const PlugIcon: LucideIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M3.75 7C3.75 8.79 5.21 10.25 7 10.25C8.79 10.25 10.25 8.79 10.25 7C10.25 5.21 8.79 3.75 7 3.75C5.21 3.75 3.75 5.21 3.75 7Z" />
    <path d="M3.75 17C3.75 18.79 5.21 20.25 7 20.25C8.79 20.25 10.25 18.79 10.25 17C10.25 15.21 8.79 13.75 7 13.75C5.21 13.75 3.75 15.21 3.75 17Z" />
    <path d="M13.75 7C13.75 8.79 15.21 10.25 17 10.25C18.79 10.25 20.25 8.79 20.25 7C20.25 5.21 18.79 3.75 17 3.75C15.21 3.75 13.75 5.21 13.75 7Z" />
    <path d="M13.75 17C13.75 18.79 15.21 20.25 17 20.25C18.79 20.25 20.25 18.79 20.25 17C20.25 15.21 18.79 13.75 17 13.75C15.21 13.75 13.75 15.21 13.75 17Z" />
    <path d="M9.5 14.5L14.5 9.5" />
  </svg>
);
export const HammerIcon = adaptIcon(IconTool);
export const HandoffIcon: LucideIcon = (props) => (
  <TbArrowsRightLeft className={props.className} style={props.style} />
);
export const InfoIcon = adaptIcon(IconInfoCircle);
export const ListChecksIcon = adaptIcon(IconListCheck);
export const ListTodoIcon = adaptIcon(IconListDetails);
export const Loader2Icon = adaptIcon(IconLoader2);
export const LoaderCircleIcon = adaptIcon(IconLoader2);
export const LoaderIcon = adaptIcon(IconLoader2);
export const Maximize2 = adaptIcon(IconMaximize);
export const Minimize2 = adaptIcon(IconMinimize);
export const MessageCircleIcon = adaptIcon(IconMessageCircle);
export const MicIcon = adaptIcon(IconMicrophone);
export const PanelRightCloseIcon = adaptIcon(IconLayoutSidebarRightCollapse);
export const PinIcon: LucideIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M8.38 15.63L12.21 19.46C13.37 20.62 15.35 19.97 15.6 18.35L16.34 13.54C16.44 12.89 16.86 12.33 17.45 12.04L20.21 10.72C21.45 10.12 21.73 8.48 20.75 7.5L16.5 3.25C15.52 2.27 13.88 2.55 13.28 3.79L11.96 6.55C11.67 7.14 11.11 7.56 10.46 7.66L5.65 8.4C4.03 8.65 3.38 10.63 4.54 11.79L8.38 15.63Z" />
    <path d="M8.38 15.62L8.38 15.63" />
    <path d="M8.375 15.625L3.75 20.25" />
  </svg>
);
export const PlayIcon = adaptIcon(IconPlayerPlay);
export const Plus = adaptIcon(IconPlus);
export const PlusIcon = adaptIcon(IconPlus);
export const RefreshCwIcon = adaptIcon(IconRefresh);
export const RotateCcwIcon = adaptIcon(IconRotate2);
export const Rows3Icon = adaptIcon(IconLayoutDistributeHorizontal);
export const SearchIcon = adaptIcon(IconSearch);
export const SettingsIcon = adaptIcon(IconSettings);
export const StarIcon = adaptIcon(IconStar);
export const StarFilledIcon = adaptIcon(IconStarFilled);
export const SunIcon = adaptIcon(IconSun);
export const MoonIcon = adaptIcon(IconMoon);
export const DeviceLaptopIcon = adaptIcon(IconDeviceLaptop);
export const SquarePenIcon = adaptIcon(IconEdit);
export const SquareSplitHorizontal: LucideIcon = (props) => (
  <PiSquareSplitHorizontal className={props.className} style={props.style} />
);
export const SquareSplitVertical: LucideIcon = (props) => (
  <PiSquareSplitVertical className={props.className} style={props.style} />
);
export const TerminalIcon = adaptIcon(IconTerminal);
export const TerminalSquare = adaptIcon(IconTerminal2);
export const TerminalSquareIcon = adaptIcon(IconTerminal2);
export const TextWrapIcon = adaptIcon(IconTextWrap);
export const Trash2 = adaptIcon(IconTrash);
export const TriangleAlertIcon = adaptIcon(IconAlertTriangle);
export const Undo2Icon = adaptIcon(IconArrowBackUp);
export const WrenchIcon = adaptIcon(IconTool);
export const WorktreeIcon: LucideIcon = (props) => (
  <LuSplit
    className={props.className}
    style={{
      ...props.style,
      transform: `${props.style?.transform ?? ""} rotate(90deg)`.trim(),
    }}
  />
);
export const XIcon = adaptIcon(IconX);
export const ZapIcon = adaptIcon(IconBolt);
