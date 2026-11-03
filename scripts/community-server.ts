/**
 * GitHub Action helper for community servers (.github/workflows/community-server.yml).
 *
 * MODE=issue (default): an issue titled "Sunucu önerisi…" was opened, edited or labelled.
 *   - opened / edited: checks the proposed server and comments the result.
 *   - labelled "onay" by the repository owner: checks again and adds it to servers.json,
 *     commits, comments and closes the issue.
 * MODE=validate: servers.json was edited by hand; fails if the file is not usable.
 *
 * Every value from the issue arrives through environment variables and is only ever
 * passed to programs as separate arguments, never through a shell.
 *
 * ZEPPELIN_DRY_RUN=1 (tests): no git, no gh; comments are printed instead.
 * ZEPPELIN_ALLOW_PRIVATE=1 (tests): accepts 127.0.0.1 so a local test server can answer.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  apiHost,
  checkEntry,
  formatServerList,
  OFFICIAL_OPERATOR,
  parseServerLine,
  parseServerList,
  sameServer,
  type EntryProblem,
  type ServerEntry,
} from '../src/serverList.ts';
import { BUILTIN_SERVERS } from '../src/content/servers.ts';

const env = process.env;
const root = env.ZEPPELIN_ROOT ?? process.cwd();
const listPath = join(root, 'servers.json');
const dryRun = env.ZEPPELIN_DRY_RUN === '1';
const allowPrivate = env.ZEPPELIN_ALLOW_PRIVATE === '1';
const APPROVE_LABEL = 'onay';
const PROPOSAL_LABEL = 'sunucu-onerisi';

const PROBLEM_TEXT: Record<EntryProblem | 'NO_LINE', string> = {
  NO_LINE: 'Sunucu satırı bulunamadı. `sudo bash zeppelin-oracle-setup.sh public-info` komutunun yazdığı `{ ... }` satırını olduğu gibi yapıştır.',
  NOT_OBJECT: 'Sunucu satırı okunamadı.',
  BAD_ID: '`id` geçersiz.',
  BAD_NAME: '`name` 1-30 karakter olmalı (harf, rakam, boşluk, nokta, - ve _).',
  BAD_COUNTRY: '`country` iki harfli ülke kodu olmalı (ör. NL).',
  BAD_API_URL: '`apiUrl` `http://IP:51821` biçiminde olmalı.',
  PRIVATE_ADDRESS: '`apiUrl` özel ya da yerel bir adres; herkese açık bir IP olmalı.',
  BAD_KEY: '`serverPublicKey` geçerli bir WireGuard anahtarı değil.',
  BAD_OPERATOR: 'GitHub kullanıcı adı okunamadı.',
};

function run(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function comment(issue: string, text: string): void {
  if (dryRun) {
    console.log(`COMMENT #${issue}:\n${text}`);
    return;
  }
  run('gh', ['issue', 'comment', issue, '--body', text]);
}

/** The current list. Refuses to go on if any line is broken, so a rewrite never drops it silently. */
function readList(): ServerEntry[] {
  const parsed = parseServerList(JSON.parse(readFileSync(listPath, 'utf8')), { allowPrivate });
  if (!parsed) throw new Error('servers.json is not usable');
  if (parsed.skipped > 0) throw new Error(`servers.json has ${parsed.skipped} invalid or duplicate entries; fix the file first`);
  return parsed.servers;
}

/** Asks the server itself for its key, so only live servers with the stated key get in. */
async function probe(entry: ServerEntry): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${entry.apiUrl}/v1/info`, { signal: controller.signal });
    if (!res.ok) return `Sunucu /v1/info isteğine ${res.status} ile cevap verdi.`;
    const info = (await res.json()) as { serverPublicKey?: unknown; endpoint?: unknown };
    if (info.serverPublicKey !== entry.serverPublicKey) {
      return 'Sunucunun bildirdiği anahtar, önerideki `serverPublicKey` ile aynı değil.';
    }
    const endpointHost = typeof info.endpoint === 'string' ? info.endpoint.replace(/:\d+$/, '').toLowerCase() : '';
    if (endpointHost !== apiHost(entry.apiUrl)) {
      return 'Sunucunun WireGuard adresi `apiUrl` ile aynı makineyi göstermiyor.';
    }
    return null;
  } catch {
    return 'Sunucuya ulaşılamadı. Sunucu açık mı ve Oracle Security List’te TCP 51821 kuralı var mı?';
  } finally {
    clearTimeout(timer);
  }
}

async function checkProposal(body: string, author: string): Promise<{ entry?: ServerEntry; problems: string[] }> {
  const raw = parseServerLine(body);
  if (!raw) return { problems: [PROBLEM_TEXT.NO_LINE] };
  // The operator is always the GitHub account that opened the issue, whatever the line says.
  const res = checkEntry({ ...raw, operator: author }, { allowPrivate });
  if (!res.ok) return { problems: [PROBLEM_TEXT[res.problem]] };
  const entry = res.entry;
  const problems: string[] = [];
  const existing = [...BUILTIN_SERVERS, ...readList()];
  const clash = existing.find((s) => sameServer(s, entry));
  if (clash) problems.push(`Bu sunucu listede zaten var (${clash.name}, ${clash.country}).`);
  const live = await probe(entry);
  if (live) problems.push(live);
  return { entry, problems };
}

function describe(e: ServerEntry): string {
  const who = e.operator === OFFICIAL_OPERATOR ? 'LenstedReal' : `Topluluk · @${e.operator}`;
  return `**${e.name}** (${e.country}) · ${who} · \`${e.apiUrl}\``;
}

async function handleIssue(): Promise<void> {
  const issue = env.ISSUE_NUMBER ?? '';
  const body = env.ISSUE_BODY ?? '';
  const author = env.ISSUE_AUTHOR ?? '';
  const action = env.EVENT_ACTION ?? '';
  const label = env.LABEL ?? '';
  const sender = env.SENDER ?? '';
  const owner = env.OWNER ?? '';

  if (action === 'labeled' && label !== APPROVE_LABEL) return; // e.g. the form's own label
  if (!dryRun) {
    // Labels the form and the owner use; created on the first proposal if missing.
    run('gh', ['label', 'create', PROPOSAL_LABEL, '--color', '1F6FEB', '--description', 'Hazır sunucu önerisi', '--force']);
    run('gh', ['label', 'create', APPROVE_LABEL, '--color', '2EA043', '--description', 'Sunucuyu listeye ekle', '--force']);
    run('gh', ['issue', 'edit', issue, '--add-label', PROPOSAL_LABEL]);
  }

  const approving = action === 'labeled' && label === APPROVE_LABEL;
  if (approving && sender !== owner) {
    comment(issue, `Yalnızca @${owner} onaylayabilir.`);
    if (!dryRun) run('gh', ['issue', 'edit', issue, '--remove-label', APPROVE_LABEL]);
    return;
  }

  const { entry, problems } = await checkProposal(body, author);
  if (problems.length > 0 || !entry) {
    const list = problems.map((p) => `- ${p}`).join('\n');
    comment(issue, `❌ ${approving ? 'Listeye eklenemedi' : 'Kontrol başarısız'}:\n\n${list}\n\nDüzeltip bu başvuruyu düzenleyebilirsin; kontrol yeniden çalışır.`);
    if (approving && !dryRun) run('gh', ['issue', 'edit', issue, '--remove-label', APPROVE_LABEL]);
    return;
  }

  if (!approving) {
    comment(
      issue,
      `✅ Kontrol tamam: ${describe(entry)}\n\nSunucu çalışıyor ve anahtarı eşleşiyor. @${owner} bu başvuruya **${APPROVE_LABEL}** etiketini eklerse sunucu listeye girer ve uygulamada herkese görünür.`,
    );
    return;
  }

  const servers = [...readList(), entry];
  writeFileSync(listPath, formatServerList(servers));
  if (!dryRun) {
    run('git', ['config', 'user.name', 'github-actions[bot]']);
    run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
    run('git', ['add', 'servers.json']);
    run('git', ['commit', '-m', `Sunucu eklendi: ${entry.name} (${entry.country}) #${issue}`]);
    for (let attempt = 0; ; attempt++) {
      try {
        run('git', ['push', 'origin', 'HEAD:main']);
        break;
      } catch (e) {
        if (attempt >= 2) throw e;
        run('git', ['pull', '--rebase', 'origin', 'main']);
      }
    }
  }
  comment(
    issue,
    `🎉 Eklendi: ${describe(entry)}\n\nUygulamayı açan herkes bu sunucuyu bir sonraki açılışta **Sunucular** sekmesinde görür. Kaldırmak için servers.json dosyasından satırını silmek yeterli.`,
  );
  if (!dryRun) run('gh', ['issue', 'close', issue, '--reason', 'completed']);
}

function validate(): void {
  const data: unknown = JSON.parse(readFileSync(listPath, 'utf8'));
  const parsed = parseServerList(data, { allowPrivate });
  if (!parsed) throw new Error('servers.json must look like { "version": 1, "servers": [ ... ] }');
  const total = Array.isArray((data as { servers?: unknown }).servers) ? (data as { servers: unknown[] }).servers.length : 0;
  if (parsed.skipped > 0) {
    throw new Error(`${parsed.skipped} of ${total} entries are invalid or duplicates; the app would skip them.`);
  }
  console.log(`servers.json OK: ${parsed.servers.length} servers`);
}

try {
  if (env.MODE === 'validate') validate();
  else await handleIssue();
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(message);
  if (env.MODE !== 'validate' && env.ISSUE_NUMBER) {
    try {
      comment(env.ISSUE_NUMBER, `⚠️ Otomatik kontrol tamamlanamadı: ${message}\n\n@${env.OWNER ?? ''} Actions sayfasındaki kaydı kontrol et.`);
    } catch {
      // the failed run is still visible on the Actions page
    }
  }
  process.exit(1);
}
