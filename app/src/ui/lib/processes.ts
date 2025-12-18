import { spawn } from 'child_process'

/**
 * Information about a running process
 */
export type ProcessInfo = {
  /** Process ID */
  pid: number
  /** Process name */
  name: string
  /** Command line arguments */
  commandLine: string
}

/**
 * Get detailed information about running processes by name
 * Returns array with PID and command line for each instance
 */
export async function getProcesses(
  processName: string
): Promise<ProcessInfo[]> {
  return new Promise(resolve => {
    const processes: ProcessInfo[] = []

    if (__WIN32__) {
      // Windows: Use WMIC to get PID and command line
      const proc = spawn('wmic', [
        'process',
        'where',
        `name='${processName}'`,
        'get',
        'ProcessId,CommandLine',
        '/format:csv',
      ])

      let output = ''
      proc.stdout.on('data', data => {
        output += data.toString()
      })

      proc.on('close', () => {
        const lines = output.split('\n').filter(l => l.trim())
        // Skip header line
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',')
          if (parts.length >= 3) {
            const commandLine = parts.slice(1, -1).join(',').trim()
            const pid = parseInt(parts[parts.length - 1].trim(), 10)

            if (!isNaN(pid) && commandLine) {
              processes.push({
                pid,
                name: processName,
                commandLine,
              })
            }
          }
        }
        resolve(processes)
      })

      proc.on('error', () => resolve([]))
    } else if (__DARWIN__) {
      // macOS: Use ps to get PID and command line
      const proc = spawn('ps', ['-A', '-o', 'pid,command'])

      let output = ''
      proc.stdout.on('data', data => {
        output += data.toString()
      })

      proc.on('close', () => {
        const lines = output.split('\n')
        for (const line of lines) {
          if (line.includes(processName)) {
            const match = line.trim().match(/^(\d+)\s+(.+)$/)
            if (match) {
              processes.push({
                pid: parseInt(match[1], 10),
                name: processName,
                commandLine: match[2],
              })
            }
          }
        }
        resolve(processes)
      })

      proc.on('error', () => resolve([]))
    } else {
      // Linux: Use ps
      const proc = spawn('ps', ['-eo', 'pid,cmd'])

      let output = ''
      proc.stdout.on('data', data => {
        output += data.toString()
      })

      proc.on('close', () => {
        const lines = output.split('\n')
        for (const line of lines) {
          if (line.includes(processName)) {
            const match = line.trim().match(/^(\d+)\s+(.+)$/)
            if (match) {
              processes.push({
                pid: parseInt(match[1], 10),
                name: processName,
                commandLine: match[2],
              })
            }
          }
        }
        resolve(processes)
      })

      proc.on('error', () => resolve([]))
    }
  })
}

/**
 * Check to see if a process is running by name
 *
 * @param processName - The name of the process (without .exe on Windows)
 * @returns Promise<boolean> - True if the process is running
 */
export async function isProcessRunning(processName: string): Promise<boolean> {
  return new Promise(resolve => {
    if (__WIN32__) {
      // Windows: use tasklist
      const proc = spawn('tasklist', [])
      let output = ''

      proc.stdout.on('data', data => {
        output += data.toString()
      })
      proc.on('close', () => {
        const isRunning = output
          .toLowerCase()
          .includes(processName.toLocaleLowerCase())
        resolve(isRunning)
      })

      proc.on('error', () => resolve(false))
    } else if (__DARWIN__) {
      // MacOS: Use pgrep
      const proc = spawn('pgrep', ['-x', processName])
      proc.on('close', code => {
        resolve(code === 0)
      })
      proc.on('error', () => resolve(false))
    } else {
      // Linux: Use pgrep
      const proc = spawn('pgrep', [processName])
      proc.on('close', code => {
        resolve(code === 0)
      })
      proc.on('error', () => resolve(false))
    }
  })
}

/**
 * Get command line arguments for a running process
 *
 * @param processName - The process to get the list of command lines from
 * @returns Promise<string[]> - An array of command lines. Blank if the process is inactive
 */
export async function getProcessCommandLines(
  processName: string
): Promise<string[]> {
  return new Promise(resolve => {
    const commandLines: string[] = []

    if (__WIN32__) {
      // Windows: Use WMIC
      const proc = spawn('wmic', [
        'process',
        'where',
        `name='${processName}'`,
        'get',
        'commandline',
        '/format:list',
      ])

      let output = ''
      proc.stdout.on('data', data => {
        output += data.toString()
      })

      proc.on('close', () => {
        // Parse WMIC output - each commandline starts with "CommandLine="
        const lines = output.split('\n')
        for (const line of lines) {
          if (line.startsWith('CommandLine=')) {
            commandLines.push(line.substring(12).trim())
          }
        }

        resolve(commandLines)
      })

      proc.on('error', () => resolve([]))
    } else if (__DARWIN__) {
      // MacOS: Use ps
      const proc = spawn('ps', ['aux'])

      let output = ''
      proc.stdout.on('data', data => {
        output += data.toString()
      })

      proc.on('close', () => {
        const lines = output.split('\n')
        for (const line of lines) {
          if (line.includes(processName)) {
            commandLines.push(line)
          }
        }
        resolve(commandLines)
      })

      proc.on('error', () => resolve([]))
    } else {
      // Linux: Read from /proc/[pid]/cmdline
      const proc = spawn('pgrep', [processName])

      let pids = ''
      proc.stdout.on('data', data => {
        pids += data.toString()
      })

      proc.on('close', async () => {
        const pidList = pids
          .trim()
          .split('\n')
          .filter(p => p)

        for (const pid of pidList) {
          try {
            const cmdline = await import('fs/promises').then(fs =>
              fs.readFile(`/proc/${pid}/cmdline`, 'utf8')
            )
            commandLines.push(cmdline.replace(/\0/g, ' '))
          } catch {
            // Process might have ended, skip it
          }
        }

        resolve(commandLines)
      })

      proc.on('error', () => resolve([]))
    }
  })
}

/**
 * Close a specific process by PID
 *
 * @param processInfo - The process to close
 * @param [timeoutMs=30000] - How long to wait for a graceful shutdown. 0 = force kill
 * @returns true if process closed successfully
 */
export async function closeProcess(
  processInfo: ProcessInfo,
  timeoutMs: number = 45000
): Promise<boolean> {
  if (__WIN32__) {
    return await closeProcessWindows(processInfo.pid, timeoutMs)
  } else {
    return await closeProcessUnix(processInfo.pid, timeoutMs)
  }
}

/**
 * Close specific process on Windows
 */
async function closeProcessWindows(
  pid: number,
  timeoutMs: number
): Promise<boolean> {
  return new Promise(resolve => {
    const procArgs: string[] = ['/PID', pid.toString(), '/T']
    // Add /F flag if we have no grace period
    if (timeoutMs <= 0) {
      procArgs.push('/F')
    }
    const proc = spawn('taskkill', procArgs)

    proc.on('close', code => {
      // For force kill, resolve immediately when taskkill completes
      if (timeoutMs <= 0) {
        resolve(code === 0)
        return
      }

      // For graceful shutdown, start polling to wait for process to exit
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        try {
          // On Windows, sending signal 0 checks if process exists
          process.kill(pid, 0)
          // Still running
          if (Date.now() - startTime > timeoutMs) {
            clearInterval(checkInterval)
            resolve(false) // Timeout
          }
        } catch {
          // Process is gone
          clearInterval(checkInterval)
          resolve(true)
        }
      }, 1000)
    })

    proc.on('error', () => resolve(false))
  })
}

/**
 * Close specific process on Unix
 */
async function closeProcessUnix(
  pid: number,
  timeoutMs: number
): Promise<boolean> {
  return new Promise(resolve => {
    try {
      // If timeout <= 0, force kill immediately
      const signal = timeoutMs <= 0 ? 'SIGKILL' : 'SIGTERM'
      process.kill(pid, signal)

      // If force killing, don't wait - it's instant
      if (timeoutMs <= 0) {
        resolve(true)
        return
      }
    } catch (e) {
      resolve(false)
      return
    }

    // Wait for process to close
    const startTime = Date.now()
    const checkInterval = setInterval(() => {
      try {
        // Sending signal 0 checks if process exists
        process.kill(pid, 0)
        // Still running
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval)
          resolve(false) // Timeout
        }
      } catch {
        // Process is gone
        clearInterval(checkInterval)
        resolve(true)
      }
    }, 1000)
  })
}
