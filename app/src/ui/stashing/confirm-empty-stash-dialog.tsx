import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { IStashEntry } from '../../models/stash-entry'
import { Row } from '../lib/row'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { EmptyStashBehavior } from '../../lib/app-state'

interface IConfirmEmptyStashDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly stashEntry: IStashEntry
  readonly onDismissed: () => void
}

interface IConfirmEmptyStashDialogState {
  readonly isLoading: boolean
}

/**
 * Dialog to choose what to do when a stash becomes empty.
 */
export class ConfirmEmptyStashDialog extends React.Component<
  IConfirmEmptyStashDialogProps,
  IConfirmEmptyStashDialogState
> {
  public constructor(props: IConfirmEmptyStashDialogProps) {
    super(props)

    this.state = {
      isLoading: false,
    }
  }

  public render() {
    const title = __DARWIN__ ? 'Empty Stash?' : 'Empty stash?'

    return (
      <Dialog
        id="empty-stash"
        type="warning"
        title={title}
        loading={this.state.isLoading}
        disabled={this.state.isLoading}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        role="alertdialog"
        ariaDescribedBy="empty-stash-warning-message"
      >
        <DialogContent>
          <Row id="empty-stash-warning-message">
            Discarding these files will leave this stash empty. Do you want to
            drop the stash, or keep it so you can add new files later?
          </Row>
          <Row>
            Your choice will be used by default next time. You can change it in{' '}
            {__DARWIN__ ? 'Settings' : 'Options'} &gt; Prompts.
          </Row>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText="Drop stash"
            cancelButtonText="Keep stash"
            onCancelButtonClick={this.onKeep}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSubmit = async () => {
    const { dispatcher, repository, stashEntry, onDismissed } = this.props

    this.setState({ isLoading: true })

    try {
      dispatcher.setEmptyStashBehaviorSetting(EmptyStashBehavior.Drop)
      await dispatcher.dropStashEntry(repository, stashEntry)
    } finally {
      this.setState({ isLoading: false })
    }

    onDismissed()
  }

  private onKeep = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    const { dispatcher, onDismissed } = this.props
    dispatcher.setEmptyStashBehaviorSetting(EmptyStashBehavior.Keep)
    onDismissed()
  }
}
