import { OcDataBuddyIcon, OcMarbleIcon, } from "@anocut/ui/icons";

export const SITE_URL = "https://anocut.app";

export const SITE_INFO = {
	title: "AnoCut",
	description:
		"AI-powered video editor with voice-driven editing. Annotate, command, and cut with natural language.",
	url: SITE_URL,
	openGraphImage: "/open-graph/default.jpg",
	twitterImage: "/open-graph/default.jpg",
	favicon: "/favicon.ico",
};

export type ExternalTool = {
	name: string;
	description: string;
	url: string;
	icon: React.ElementType;
};

export const EXTERNAL_TOOLS: ExternalTool[] = [
	{
		name: "Marble",
		description:
			"Modern headless CMS for content management and the blog for AnoCut",
		url: "https://marblecms.com?utm_source=anocut",
		icon: OcMarbleIcon,
	},
	{
		name: "Databuddy",
		description: "GDPR compliant analytics and user insights for AnoCut",
		url: "https://databuddy.cc?utm_source=anocut",
		icon: OcDataBuddyIcon,
	},
];

export const DEFAULT_LOGO_URL = "/logos/anocut/svg/logo.svg";

export const SOCIAL_LINKS = {
	x: "https://x.com/anocutapp",
	github: "https://github.com/jc-able/anocut",
	discord: "https://discord.com/invite/Mu3acKZvCp",
};

export type Sponsor = {
	name: string;
	url: string;
	logo: string;
	description: string;
};

export const SPONSORS: Sponsor[] = [
	{
		name: "Fal.ai",
		url: "https://fal.ai?utm_source=anocut",
		logo: "/logos/others/fal.svg",
		description: "Generative image, video, and audio models all in one place.",
	},
	{
		name: "Vercel",
		url: "https://vercel.com?utm_source=anocut",
		logo: "/logos/others/vercel.svg",
		description: "Platform where we deploy and host AnoCut.",
	},
];
