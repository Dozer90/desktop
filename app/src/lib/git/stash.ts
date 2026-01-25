import { GitError as DugiteError } from 'dugite'
import { coerceToString, git, GitError } from './core'
import { Repository } from '../../models/repository'
import {
  IStashEntry,
  StashedChangesLoadStates,
  StashedFileChanges,
} from '../../models/stash-entry'
import {
  WorkingDirectoryFileChange,
  CommittedFileChange,
} from '../../models/status'
import { parseRawLogWithNumstat } from './log'
import { stageFiles } from './update-index'
import { Branch } from '../../models/branch'
import { createLogParser } from './git-delimiter-parser'

export const DesktopStashEntryMarker = '!!GitHub_Desktop'

/**
 * RegEx for determining if a stash entry is created by Desktop
 *
 * This is done by looking for a magic string with the following
 * format: `!!GitHub_Desktop<branch>`
 */

const stashEntryMessageRe = /On ([^:]+): (.+)$/
const desktopStashEntryMessageRe = new RegExp(
  `${DesktopStashEntryMarker}<([^|>]+)(?:\\s*\\|\\s*([^>]+))?>\\s*(.*)`
)

type StashResult = {
  /** The stash entries created by Desktop and other tools */
  readonly allEntries: ReadonlyArray<IStashEntry>

  /**
   * The total amount of stash entries,
   * i.e. stash entries created both by Desktop and outside of Desktop
   */
  readonly stashEntryCount: number
}

type ParsedStashMessage = {
  readonly branch?: string
  readonly description: string
  readonly userfriendlyName: string
  readonly isGitHubDesktop: boolean
}

/**
 * Get the list of stash entries created by Desktop in the current repository
 * using the default ordering of refs (which is LIFO ordering),
 * as well as the total amount of stash entries.
 */
export async function getStashes(repository: Repository): Promise<StashResult> {
  const { formatArgs, parse } = createLogParser({
    name: '%gD',
    stashSha: '%H',
    message: '%gs',
    tree: '%T',
    parents: '%P',
  })

  const result = await git(
    ['log', '-g', ...formatArgs, 'refs/stash', '--'],
    repository.path,
    'getStashEntries',
    { successExitCodes: new Set([0, 128]) }
  )

  // There's no refs/stashes reflog in the repository or it's not
  // even a repository. In either case we don't care
  if (result.exitCode === 128) {
    return { allEntries: [], stashEntryCount: 0 }
  }

  const allEntries: Array<IStashEntry> = []
  const files: StashedFileChanges = { kind: StashedChangesLoadStates.NotLoaded }

  const entries = parse(result.stdout)

  for (const { name, message, stashSha, tree, parents } of entries) {
    // if the stash entry is created by GitHub Desktop, we add it to the desktopEntries array
    // otherwise, we add it to the otherStashes array
    // we can identify the stash entry created by GitHub Desktop by looking for the
    // DesktopStashEntryMarker string in the stash entry message

    const parsedStashMessage = parseStashMessage(message)
    const branchName = parsedStashMessage.branch || name

    allEntries.push({
      name,
      stashSha,
      branchName,
      userfriendlyName: parsedStashMessage.userfriendlyName,
      description: parsedStashMessage.description,
      tree,
      parents: parents.length > 0 ? parents.split(' ') : [],
      files,
      isGitHubDesktop: parsedStashMessage.isGitHubDesktop,
    })
  }

  return {
    allEntries,
    stashEntryCount: entries.length - 1,
  }
}

/**
 * Moves a stash entry to a different branch by means of creating
 * a new stash entry associated with the new branch and dropping the old
 * stash entry.
 */
export async function moveStashEntry(
  repository: Repository,
  { stashSha, parents, tree, userfriendlyName, description }: IStashEntry,
  branchName: string
) {
  const message = `On ${branchName}: ${createDesktopStashMessage(
    branchName,
    userfriendlyName,
    description
  )}`
  const parentArgs = parents.flatMap(p => ['-p', p])

  const { stdout: commitId } = await git(
    ['commit-tree', ...parentArgs, '-m', message, '--no-gpg-sign', tree],
    repository.path,
    'moveStashEntryToBranch'
  )

  await git(
    ['stash', 'store', '-m', message, commitId.trim()],
    repository.path,
    'moveStashEntryToBranch'
  )

  await dropDesktopStashEntry(repository, stashSha)
}

/**
 * Returns the last Desktop created stash entry for the given branch
 */
export async function getLastDesktopStashEntryForBranch(
  repository: Repository,
  branch: Branch | string
) {
  const stash = await getStashes(repository)
  const branchName = typeof branch === 'string' ? branch : branch.name

  // Since stash objects are returned in a LIFO manner, the first
  // entry found is guaranteed to be the last entry created
  return (
    stash.allEntries.find(
      stash => stash.branchName === branchName && stash.isGitHubDesktop
    ) || null
  )
}

/** Creates a stash entry message that indicates the entry was created by Desktop */
export function createDesktopStashMessage(
  branchName: string,
  stashName: string | null,
  description: string | null
): string {
  let msg = `${DesktopStashEntryMarker}<${branchName}`
  const trimmedName = stashName ? stashName.trim() : ''
  if (trimmedName.length > 0) {
    msg += ` | ${trimmedName}`
  }
  msg += '>'
  const trimmedDescription = description ? description.trim() : ''
  if (trimmedDescription.length > 0) {
    msg += ` ${trimmedDescription}`
  }
  return msg
}

/**
 * Stash the working directory changes for the current branch
 */
export async function createDesktopStashEntry(
  repository: Repository,
  branch: Branch | string,
  stashName: string | null,
  description: string | null,
  discard: boolean,
  untrackedFilesToStage: ReadonlyArray<WorkingDirectoryFileChange>
): Promise<boolean> {
  // We must ensure that no untracked files are present before stashing
  // See https://github.com/desktop/desktop/pull/8085
  // First ensure that all changes in file are selected
  // (in case the user has not explicitly checked the checkboxes for the untracked files)
  const fullySelectedUntrackedFiles = untrackedFilesToStage.map(x =>
    x.withIncludeAll(true)
  )
  await stageFiles(repository, fullySelectedUntrackedFiles)

  const branchName = typeof branch === 'string' ? branch : branch.name
  const message = `On ${branchName}: ${createDesktopStashMessage(
    branchName,
    stashName,
    description
  )}`

  if (!discard) {
    // When not discarding, we create the stash first and then store so it does not
    // modify the working directory
    let args = ['stash', 'create']
    const { stdout: stashSha } = await git(
      args,
      repository.path,
      'createStashCommit'
    )
    const trimmedSha = stashSha.trim()
    if (trimmedSha.length === 0) {
      return false
    }

    // Now, we store the files in the newly created stash
    args = ['stash', 'store', '-m', message, trimmedSha]
    await git(args, repository.path, 'storeStashEntry')

    return true
  }

  const args = ['stash', 'push', '-m', message]
  const result = await git(args, repository.path, 'createStashEntry').catch(
    e => {
      // Note: 2024: Here be dragons. As I converted this code to get rid of the
      // successExitCode use I got curious about the assumptions made in the
      // following logic. It assumes that as long as the exit code for `git
      // stash push` is 1 and there are no lines beginning with "error: " then
      // a stash was created. That didn't hold up to a quick read of the stash
      // code. For example, running git stash push in an unborn repository will
      // get you an exit code of 1 but no stash was created:
      //
      // % git stash push -m foo ; echo $?
      // You do not have the initial commit yet
      // 1
      //
      // I'm not going to mess with this now but I felt the need to document
      // my findings should I or any other brave soul choose to tackle this in
      // the future.
      if (e instanceof GitError && e.result.exitCode === 1) {
        // search for any line starting with `error:` -  /m here to ensure this is
        // applied to each line, without needing to split the text
        const errorPrefixRe = /^error: /m

        const matches = errorPrefixRe.exec(coerceToString(e.result.stderr))
        if (matches !== null && matches.length > 0) {
          // rethrow, because these messages should prevent the stash from being created
          return Promise.reject(e)
        }

        // if no error messages were emitted by Git, we should log but continue because
        // a valid stash was created and this should not interfere with the checkout

        log.info(
          `[createDesktopStashEntry] a stash was created successfully but exit code ${e.result.exitCode} reported. stderr: ${e.result.stderr}`
        )
        return e.result
      }
      return Promise.reject(e)
    }
  )

  // Stash doesn't consider it an error that there aren't any local changes to save.
  if (result.stdout === 'No local changes to save\n') {
    return false
  }

  return true
}

/**
 * Stash only the given paths.
 *
 * Returns the created stash entry or null if no stash was created.
 */
export async function createDesktopStashEntryForPaths(
  repository: Repository,
  branch: Branch | string,
  stashName: string | null,
  description: string | null,
  discard: boolean,
  paths: ReadonlyArray<string>,
  includeUntracked: boolean
): Promise<IStashEntry | null> {
  if (paths.length === 0) {
    return null
  }

  const branchName = typeof branch === 'string' ? branch : branch.name
  const message = `On ${branchName}: ${createDesktopStashMessage(
    branchName,
    stashName,
    description
  )}`

  const args = ['stash', 'push', '-m', message]
  if (includeUntracked) {
    args.push('-u')
  }
  args.push('--', ...paths)

  const result = await git(
    args,
    repository.path,
    'createStashEntryForPaths'
  ).catch(e => {
    if (e instanceof GitError && e.result.exitCode === 1) {
      const errorPrefixRe = /^error: /m

      const matches = errorPrefixRe.exec(coerceToString(e.result.stderr))
      if (matches !== null && matches.length > 0) {
        return Promise.reject(e)
      }

      log.info(
        `[createDesktopStashEntryForPaths] a stash was created successfully but exit code ${e.result.exitCode} reported. stderr: ${e.result.stderr}`
      )
      return e.result
    }
    return Promise.reject(e)
  })

  if (result.stdout === 'No local changes to save\n') {
    return null
  }

  const { allEntries } = await getStashes(repository)
  const createdEntry = allEntries.length > 0 ? allEntries[0] : null

  if (createdEntry !== null && discard === false) {
    await applyStashEntry(repository, createdEntry.stashSha)
  }

  return createdEntry
}

async function getStashEntryMatchingSha(repository: Repository, sha: string) {
  const stash = await getStashes(repository)
  return stash.allEntries.find(e => e.stashSha === sha) || null
}

/**
 * Removes the given stash entry if it exists
 *
 * @param stashSha the SHA that identifies the stash entry
 */
export async function dropDesktopStashEntry(
  repository: Repository,
  stashSha: string
) {
  const entryToDelete = await getStashEntryMatchingSha(repository, stashSha)

  if (entryToDelete !== null) {
    const args = ['stash', 'drop', entryToDelete.name]
    await git(args, repository.path, 'dropStashEntry')
  }
}

/**
 * Pops the stash entry identified by matching `stashSha` to its commit hash.
 *
 * To see the commit hash of stash entry, run
 * `git log -g refs/stash --pretty="%nentry: %gd%nsubject: %gs%nhash: %H%n"`
 * in a repo with some stash entries.
 */
export async function popStashEntry(
  repository: Repository,
  stashSha: string
): Promise<void> {
  // ignoring these git errors for now, this will change when we start
  // implementing the stash conflict flow
  const expectedErrors = new Set<DugiteError>([DugiteError.MergeConflicts])
  const stashToPop = await getStashEntryMatchingSha(repository, stashSha)

  if (stashToPop !== null) {
    const args = ['stash', 'pop', '--quiet', `${stashToPop.name}`]
    await git(args, repository.path, 'popStashEntry', {
      expectedErrors,
    }).catch(e => {
      // popping a stashes that create conflicts in the working directory
      // report an exit code of `1` and are not dropped after being applied.
      // so, we check for this case and drop them manually unless there's
      // anything in stderr as that could have prevented the stash from being
      // popped. Not the greatest approach but stash isn't very communicative
      if (
        e instanceof GitError &&
        e.result.exitCode === 1 &&
        e.result.stderr.length === 0
      ) {
        log.info(
          `[popStashEntry] a stash was popped successfully but exit code ${e.result.exitCode} reported.`
        )
        // bye bye
        return dropDesktopStashEntry(repository, stashSha)
      }
      return Promise.reject(e)
    })
  }
}

/**
 * Apply the stash entry identified by matching `stashSha` to its commit hash.
 * Apply does NOT pop the stash, allowing you to keep it and modify it later.
 */
export async function applyStashEntry(
  repository: Repository,
  stashSha: string
): Promise<void> {
  // ignoring these git errors for now, this will change when we start
  // implementing the stash conflict flow
  const expectedErrors = new Set<DugiteError>([DugiteError.MergeConflicts])
  const stashToApply = await getStashEntryMatchingSha(repository, stashSha)

  if (stashToApply !== null) {
    const args = ['stash', 'apply', '--quiet', `${stashToApply.name}`]
    await git(args, repository.path, 'applyStashEntry', {
      expectedErrors,
    }).catch(e => {
      // applying a stashes that create conflicts in the working directory
      // report an exit code of `1` and are not dropped after being applied.
      // so, we check for this case and drop them manually unless there's
      // anything in stderr as that could have prevented the stash from being
      // popped. Not the greatest approach but stash isn't very communicative
      if (
        e instanceof GitError &&
        e.result.exitCode === 1 &&
        e.result.stderr.length === 0
      ) {
        log.info(
          `[applyStashEntry] a stash was applied successfully but exit code ${e.result.exitCode} reported.`
        )
      }
      return Promise.reject(e)
    })
  }
}

/**
 * Parse a stash message and extract all relevant information
 *
 * Git stash messages have the format: "On <branch>: <description>"
 * Git Desktop uses the following:     "On <branch>: !!GitHub_Desktop<branch | stashName> description"
 *                                     "On <branch>: !!GitHub_Desktop<branch | stashName>"
 *                                     "On <branch>: !!GitHub_Desktop<branch> description"
 *                                     "On <branch>: !!GitHub_Desktop<branch>"
 */

function parseStashMessage(message: string): ParsedStashMessage {
  const match = stashEntryMessageRe.exec(message) // Captures: On <branch>: <everything-else>
  const isGitHubDesktop = extractIsGitHubDesktopStashEntry(message)
  const branch = match ? match[1] : undefined
  const fullDescription = match ? match[2] : message

  let userfriendlyName = ''
  let description = fullDescription

  if (isGitHubDesktop) {
    // Pattern: !!GitHub_Desktop<branch | stashName> optional-description
    // or:      !!GitHub_Desktop<branch> optional-description
    const desktopMatch = desktopStashEntryMessageRe.exec(fullDescription)

    if (desktopMatch) {
      // desktopMatch[1] = branch (we already have this)
      // desktopMatch[2] = stashName (if it exists after the |)
      // desktopMatch[3] = everything after the >

      const stashName = desktopMatch[2] ? desktopMatch[2].trim() : ''
      const afterMessage = desktopMatch[3] ? desktopMatch[3].trim() : ''

      userfriendlyName = stashName
      description = afterMessage || stashName || fullDescription
    } else {
      // Fallback if the regex doesn't match (shouldn't happen for valid Desktop stashes)
      description = fullDescription
    }
  } else {
    // Non-Desktop stash: use the whole description as the friendly name
    userfriendlyName = fullDescription
  }

  return {
    branch,
    description,
    userfriendlyName,
    isGitHubDesktop,
  }
}

function extractIsGitHubDesktopStashEntry(message: string): boolean {
  return message.includes(DesktopStashEntryMarker)
}

/** Get the files that were changed in the given stash commit */
export async function getStashedFiles(
  repository: Repository,
  stashSha: string
): Promise<ReadonlyArray<CommittedFileChange>> {
  const args = [
    'stash',
    'show',
    '-M',
    '-u',
    stashSha,
    '--raw',
    '--numstat',
    '-z',
    '--format=format:',
    '--no-show-signature',
    '--',
  ]

  const { stdout } = await git(args, repository.path, 'getStashedFiles')

  return parseRawLogWithNumstat(stdout, stashSha, `${stashSha}^`).files
}
