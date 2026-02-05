import Image from "next/image";
import { DEFAULT_LOGO_URL } from "@/constants/site-constants";

export function Footer() {
	return (
		<footer className="bg-background border-t border-border">
			<div className="mx-auto max-w-5xl px-8 py-4">
				<div className="flex flex-col md:flex-row items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<Image
							src={DEFAULT_LOGO_URL}
							alt="AnoCut"
							width={20}
							height={20}
							className="rounded"
						/>
						<span className="font-medium">AnoCut</span>
						<span className="text-muted-foreground text-sm">
							AI-powered video editor
						</span>
					</div>

					<span className="text-muted-foreground text-sm">
						© {new Date().getFullYear()} AnoCut
					</span>
				</div>
			</div>
		</footer>
	);
}
