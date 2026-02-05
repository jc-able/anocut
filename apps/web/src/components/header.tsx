import Link from "next/link";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { DEFAULT_LOGO_URL } from "@/constants/site-constants";

export function Header() {
	return (
		<header className="bg-background border-b border-border sticky top-0 z-10">
			<div className="flex w-full items-center justify-between px-6 py-3">
				<Link href="/" className="flex items-center gap-2">
					<Image
						src={DEFAULT_LOGO_URL}
						alt="AnoCut Logo"
						width={28}
						height={28}
						className="rounded-md"
					/>
					<span className="text-lg font-bold">AnoCut</span>
				</Link>

				<div className="flex items-center gap-3">
					<Link href="/projects">
						<Button variant="foreground" className="text-sm">
							Projects
							<ArrowRight className="size-4" />
						</Button>
					</Link>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
