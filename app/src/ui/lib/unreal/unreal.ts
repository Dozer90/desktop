import * as Path from 'path'
import * as FSE from 'fs-extra'
import { Repository } from '../../../models/repository'
import { ProcessInfo, getProcesses, isProcessRunning } from '../processes'

/**
 * Check to see if the Unreal Engine editor is running
 */
export async function isUnrealEditorRunning(): Promise<boolean> {
  const processNames = __WIN32__
    ? [
        'UnrealEditor.exe',
        'UE4Editor.exe',
        'UE5Editor.exe',
        'UnrealEditor-Win64-Debug.exe',
      ]
    : ['UnrealEditor', 'UE4Editor', 'UE5Editor']

  // Check each process name
  for (const processName of processNames) {
    if (await isProcessRunning(processName)) {
      return true
    }
  }

  return false
}

/**
 * Check if a specific .uproject file is currently open in Unreal
 *
 * @param repository - The repository we want to check
 * @returns ProcessInfo | null - Information on the UE process with the uproject open, if any
 */
export async function getUnrealEditorForProject(
  repository: Repository
): Promise<ProcessInfo | null> {
  const uProjectFile = await isUnrealProject(repository)
  if (!uProjectFile) {
    return null
  }

  const pathAsLower = Path.normalize(
    Path.join(repository.path, uProjectFile)
  ).toLowerCase()
  const processNames = __WIN32__
    ? [
        'UnrealEditor.exe',
        'UE4Editor.exe',
        'UE5Editor.exe',
        'UnrealEditor-Win64-Debug.exe',
      ]
    : ['UnrealEditor', 'UE4Editor', 'UE5Editor']

  for (const processName of processNames) {
    const processes = await getProcesses(processName)
    for (const proc of processes) {
      const commandAsLower = proc.commandLine.toLowerCase()
      if (
        commandAsLower.includes(pathAsLower) ||
        commandAsLower.includes(Path.basename(pathAsLower))
      ) {
        return proc
      }
    }
  }

  return null
}

/**
 * Check if this repository is a UE based project
 */
export async function isUnrealProject(
  repository: Repository
): Promise<string | null> {
  try {
    const files = await FSE.readdir(repository.path)
    const uProjectFile = files.find(f => f.endsWith('.uproject'))
    return uProjectFile || null
  } catch {
    return null
  }
}

/**
 * Check to see if the file is an Unreal asset
 */
export function isUnrealAsset(path: string): boolean {
  const ext = Path.extname(path).toLowerCase()
  return ['.uasset', '.umap', '.uclass'].includes(ext)
}

/**
 * Get paths to Unreal Engine assets from a list of file paths
 */
export function getUnrealAssetPaths(paths: ReadonlyArray<string>): Set<string> {
  const unrealAssets = new Set<string>()
  for (const path of paths) {
    if (isUnrealAsset(path)) {
      unrealAssets.add(path)
    }
  }
  return unrealAssets
}

/**
 * Find the specific Unreal Editor process that has a .uproject file open
 *
 * @param uprojectPath - Full path to the .uproject file
 * @returns ProcessInfo if found, null otherwise
 */
export async function findUnrealEditorWithProject(
  uprojectPath: string
): Promise<ProcessInfo | null> {
  const normalizedPath = Path.normalize(uprojectPath).toLowerCase()
  const projectName = Path.basename(uprojectPath)

  const processNames = __WIN32__
    ? ['UnrealEditor.exe', 'UE4Editor.exe', 'UE5Editor.exe']
    : ['UnrealEditor', 'UE4Editor', 'UE5Editor']

  for (const processName of processNames) {
    const processes = await getProcesses(processName)

    for (const proc of processes) {
      const normalizedCmd = proc.commandLine.toLowerCase()

      // Check if command line contains this .uproject path or name
      if (
        normalizedCmd.includes(normalizedPath) ||
        normalizedCmd.includes(projectName.toLowerCase())
      ) {
        return proc
      }
    }
  }

  return null
}
