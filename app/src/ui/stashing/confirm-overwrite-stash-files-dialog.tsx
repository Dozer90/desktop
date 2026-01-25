import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { Row } from '../lib/row'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { IStashEntry } from '../../models/stash-entry'

interface IConfirmOverwriteStashFilesProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly stashEntry: IStashEntry
  readonly filePaths: ReadonlyArray<string>
  readonly stashName: string
  readonly description: string
  readonly discard: boolean
  readonly onDismissed: () => void
}

interface IConfirmOverwriteStashFilesState {
  readonly isLoading: boolean
}

/**
 * Dialog that alerts the user that files in the stash will be overwritten.
 */
export class ConfirmOverwriteStashFilesDialog extends React.Component<
  IConfirmOverwriteStashFilesProps,
  IConfirmOverwriteStashFilesState
> {
  public constructor(props: IConfirmOverwriteStashFilesProps) {
    super(props)
    this.state = { isLoading: false }
  }

  public render() {
    const title = __DARWIN__
      ? 'Overwrite Stashed Files?'
      : 'Overwrite stashed files?'

    return (
      <Dialog
        id="overwrite-stash-files"
        type="warning"
        title={title}
        loading={this.state.isLoading}
        disabled={this.state.isLoading}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        role="alertdialog"
        ariaDescribedBy="overwrite-stash-files-warning-message"
      >
        <DialogContent>
          <Row id="overwrite-stash-files-warning-message">
            The selected files already exist in the stash. Continuing will
            replace their stashed versions with your working directory versions.
          </Row>
          <Row>
            <ul>
              {this.props.filePaths.map(path => (
                <li key={path}>{path}</li>
              ))}
            </ul>
          </Row>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup destructive={true} okButtonText="Overwrite" />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSubmit = async () => {
    const {
      dispatcher,
      repository,
      stashEntry,
      stashName,
      description,
      discard,
      onDismissed,
    } = this.props

    this.setState({ isLoading: true })

    try {
      await dispatcher.addFilesToStashEntry(
        repository,
        stashEntry,
        stashName,
        description,
        discard,
        true
      )
    } finally {
      this.setState({ isLoading: false })
    }

    onDismissed()
  }
}
