import { git } from './core'
import { Repository } from '../../models/repository'
import * as Path from 'path'
import * as FSE from 'fs-extra'

/** Install the global LFS filters. */
export async function installGlobalLFSFilters(force: boolean): Promise<void> {
  const args = ['lfs', 'install', '--skip-repo']
  if (force) {
    args.push('--force')
  }

  await git(args, __dirname, 'installGlobalLFSFilter')
}

/** Install LFS hooks in the repository. */
export async function installLFSHooks(
  repository: Repository,
  force: boolean
): Promise<void> {
  const args = ['lfs', 'install']
  if (force) {
    args.push('--force')
  }

  await git(args, repository.path, 'installLFSHooks')
}

/** Is the repository configured to track any paths with LFS? */
export async function isUsingLFS(repository: Repository): Promise<boolean> {
  const env = {
    GIT_LFS_TRACK_NO_INSTALL_HOOKS: '1',
  }
  const result = await git(['lfs', 'track'], repository.path, 'isUsingLFS', {
    env,
  })
  return result.stdout.length > 0
}

/**
 * Check if a provided file path is being tracked by Git LFS
 *
 * This uses the Git plumbing to read the .gitattributes file
 * for any LFS-related rules that are set for the file
 *
 * @param repository repository with
 * @param path relative file path in the repository
 */
export async function isTrackedByLFS(
  repository: Repository,
  path: string
): Promise<boolean> {
  const { stdout } = await git(
    ['check-attr', 'filter', path],
    repository.path,
    'checkAttrForLFS'
  )

  // "git check-attr -a" will output every filter it can find in .gitattributes
  // and it looks like this:
  //
  // README.md: diff: lfs
  // README.md: merge: lfs
  // README.md: text: unset
  // README.md: filter: lfs
  //
  // To verify git-lfs this test will just focus on that last row, "filter",
  // and the value associated with it. If nothing is found in .gitattributes
  // the output will look like this
  //
  // README.md: filter: unspecified

  const lfsFilterRegex = /: filter: lfs/

  const match = lfsFilterRegex.exec(stdout)

  return match !== null
}

/**
 * Query a Git repository and filter the set of provided relative paths to see
 * which are not covered by the current Git LFS configuration.
 *
 * @param repository
 * @param filePaths List of relative paths in the repository
 */
export async function filesNotTrackedByLFS(
  repository: Repository,
  filePaths: ReadonlyArray<string>
): Promise<ReadonlyArray<string>> {
  const filesNotTrackedByGitLFS = new Array<string>()

  for (const file of filePaths) {
    const isTracked = await isTrackedByLFS(repository, file)

    if (!isTracked) {
      filesNotTrackedByGitLFS.push(file)
    }
  }

  return filesNotTrackedByGitLFS
}

/**
 * Check if a file is an LFS pointer file by reading its content
 *
 * LFS pointer files are small text files that begin with:
 * version https://git-lfs.github.com/spec/v1
 */
export async function isLFSPointerFile(
  repository: Repository,
  path: string
): Promise<boolean> {
  try {
    const fullPath = Path.join(repository.path, path)

    // LFS pointers are always small (<200 bytes typically)
    const stats = await FSE.stat(fullPath)
    if (stats.size > 500) {
      return false
    }

    // Read the first line
    const content = await FSE.readFile(fullPath, 'utf8')
    return content.startsWith('version https://git-lfs.github.com/spec/v1')
  } catch (error) {
    // If we can't read the file, assume it's not an LFS pointer
    return false
  }
}

/**
 * Check multiple files for LFS pointers
 * Returns a Set of paths that are LFS pointers
 */
export async function getLFSPointerFilePaths(
  repository: Repository,
  paths: ReadonlyArray<string>
): Promise<Set<string>> {
  const lfsPointers = new Set<string>()
  await Promise.all(
    paths.map(async path => {
      if (await isLFSPointerFile(repository, path)) {
        lfsPointers.add(path)
      }
    })
  )
  return lfsPointers
}
