import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'
import { Row } from '../lib/row'
import { IStashEntry } from '../../models/stash-entry'

interface IStashCheckedFilesDialogProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly stashEntries: ReadonlyArray<IStashEntry>
  readonly onDismissed: () => void
}

interface IStashCheckedFilesDialogState {
  readonly selectedStashId: string // 'new' or stash entry ID
  readonly newStashName: string
  readonly isStashing: boolean
}

export class StashCheckedFilesDialog extends React.Component<
  IStashCheckedFilesDialogProps,
  IStashCheckedFilesDialogState
> {
  public constructor(props: IStashCheckedFilesDialogProps) {
    super(props)
    this.state = {
      selectedStashId: 'new',
      newStashName: '',
      isStashing: false,
    }
  }

  private onStashSelectionChange = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    this.setState({ selectedStashId: event.currentTarget.value })
  }

  private onNewStashNameChange = (value: string) => {
    this.setState({ newStashName: value })
  }

  private onStashCheckedFiles = async () => {
    const { repository, dispatcher, stashEntries } = this.props
    const { selectedStashId, newStashName } = this.state

    this.setState({ isStashing: true })

    if (selectedStashId === 'new') {
      // Create new stash
      const fullMessage = newStashName ? `${newStashName} - desktop` : 'desktop'
      await dispatcher.createStashForFiles(repository, 'checked', fullMessage)
    } else {
      // Add to existing stash
      const existingStash = stashEntries.find(
        s => s.stashSha === selectedStashId
      )
      if (existingStash) {
        await dispatcher.addFilesToStash(repository, existingStash, 'all')
      }
    }

    this.props.onDismissed()
  }

  public render() {
    const { stashEntries } = this.props
    const { selectedStashId, newStashName, isStashing } = this.state
    const isNewStash = selectedStashId === 'new'

    return (
      <Dialog
        title="Stash Checked Files"
        onDismissed={this.props.onDismissed}
        onSubmit={this.onStashCheckedFiles}
        disabled={isStashing}
      >
        <DialogContent>
          <Row>
            <label htmlFor="stash-dropdown">Add to stash</label>
            <select
              id="stash-dropdown"
              value={selectedStashId}
              onChange={this.onStashSelectionChange}
              disabled={isStashing}
            >
              <option value="new">New stash...</option>
              {stashEntries.map(stash => (
                <option key={stash.stashSha} value={stash.stashSha}>
                  {stash.userfriendlyName ? stash.userfriendlyName : stash.name}
                </option>
              ))}
            </select>
          </Row>

          {isNewStash && (
            <Row>
              <TextBox
                label="Stash name (optional)"
                placeholder="e.g., WIP: feature implementation"
                value={newStashName}
                onValueChanged={this.onNewStashNameChange}
                disabled={isStashing}
              />
            </Row>
          )}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={isStashing ? 'Stashing Files…' : 'Stash Files'}
            okButtonDisabled={isStashing}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
