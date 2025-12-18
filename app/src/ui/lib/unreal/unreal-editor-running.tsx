import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../../dialog'
import { Repository } from '../../../models/repository'
import { Dispatcher } from '../../dispatcher'
import { OkCancelButtonGroup } from '../../dialog/ok-cancel-button-group'
import { ProcessInfo, closeProcess } from '../processes'

interface IUnrealEditorRunningProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly activeProc: ProcessInfo
  readonly onDismissed: () => void
}

interface IUnrealEditorRunningState {
  readonly isClosing: boolean
  readonly closeFailed: boolean
}

export class UnrealEditorRunning extends React.Component<
  IUnrealEditorRunningProps,
  IUnrealEditorRunningState
> {
  public constructor(props: IUnrealEditorRunningProps) {
    super(props)
    this.state = {
      isClosing: false,
      closeFailed: false,
    }
  }

  private performPull = () => {
    this.props.dispatcher.pull(this.props.repository, false)
  }

  private onCloseAndPull = async () => {
    this.setState({ isClosing: true, closeFailed: false })

    // Actually close the Unreal Editor process
    const success = await closeProcess(this.props.activeProc, 45000) // 45 second timeout

    if (success) {
      // Successfully closed, dismiss dialog and pull
      this.props.onDismissed()
      this.performPull()
    } else {
      // Failed to close
      this.setState({ isClosing: false, closeFailed: true })
    }
  }

  public render() {
    const { isClosing, closeFailed } = this.state

    return (
      <Dialog
        title="Project is Open"
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
        type="warning"
      >
        <DialogContent>
          <p>
            The project is currently open in Unreal Editor. Pulling now may
            cause file conflicts, corruptions, or just fail outright.
          </p>
          <p>
            It is <b>strongly</b> recommended you close the editor before
            continuing.
          </p>
          {closeFailed && (
            <p className="error-message">
              <b>Failed to close Unreal Editor.</b> Please close it manually and
              try again.
            </p>
          )}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={
              isClosing ? 'Closing Editor...' : 'Close Editor & Continue'
            }
            cancelButtonText="Cancel"
            onOkButtonClick={this.onCloseAndPull}
            onCancelButtonClick={this.props.onDismissed}
            okButtonDisabled={isClosing}
            destructive={false}
          />
          <button onClick={this.performPull} disabled={isClosing}>
            Continue Anyway
          </button>
        </DialogFooter>
      </Dialog>
    )
  }
}
