import { ArrowLeft, ExternalLink, Tag } from "lucide-react";
import Link from "next/link";
import { ReleaseBody } from "./release-body";
import packageJson from "../../../package.json";

export const revalidate = 3600;

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string;
  html_url: string;
}

async function fetchReleases(): Promise<GitHubRelease[]> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/phucsystem/agent-playground/releases?per_page=20",
      {
        headers: { Accept: "application/vnd.github+json" },
      }
    );
    if (!response.ok) {
      console.warn(`[changelog] GitHub API returned ${response.status}`);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.warn("[changelog] Failed to fetch GitHub releases:", error);
    return [];
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ChangelogPage() {
  const releases = await fetchReleases();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/chat"
          className="p-2 -ml-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          aria-label="Back to chat"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-neutral-800">Release Notes</h1>
          <p className="text-sm text-neutral-400">v{packageJson.version}</p>
        </div>
      </div>

      {releases.length === 0 ? (
        <div className="text-center py-16">
          <Tag className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No releases found.</p>
          <p className="text-sm text-neutral-400 mt-1">Release notes will appear here after the next deployment.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {releases.map((release, index) => (
            <div key={release.id}>
              <div className="py-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-800">
                      {release.name || release.tag_name}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {formatDate(release.published_at)}
                    </p>
                  </div>
                  <a
                    href={release.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded-md text-neutral-400 hover:text-primary-500 hover:bg-primary-50 transition"
                    title="View on GitHub"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                {release.body && <ReleaseBody content={release.body} />}
              </div>
              {index < releases.length - 1 && (
                <hr className="border-neutral-100" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
