import * as React from 'react'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { IStashEntry } from '../../models/stash-entry'
import { CommittedFileChange } from '../../models/status'
import { Button } from '../lib/button'
import { Checkbox, CheckboxValue } from '../lib/checkbox'

interface IStashActionsPanelProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly stashEntry: IStashEntry
  readonly selectedFiles: ReadonlyArray<CommittedFileChange>
  readonly isRestoring: boolean
  readonly isDiscarding: boolean
}

interface IStashActionsPanelState {
  readonly discardOnRestore: boolean
}

export class StashActionsPanel extends React.Component<
  IStashActionsPanelProps,
  IStashActionsPanelState
> {
  public constructor(props: IStashActionsPanelProps) {
    super(props)

    this.state = {
      discardOnRestore: true,
    }
  }

  private onDiscardOnRestoreChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked
    this.setState({ discardOnRestore: value })
  }

  private onRestoreClick = () => {
    const { repository, dispatcher, stashEntry } = this.props
    const { discardOnRestore } = this.state

    if (discardOnRestore) {
      // Use popStash - restores and removes from stash list
      dispatcher.popStash(repository, stashEntry)
    } else {
      // Use applyStash - restores but keeps in stash list
      dispatcher.applyStash(repository, stashEntry)
    }
  }

  private onDiscardClick = () => {
    const { selectedFiles } = this.props

    if (selectedFiles.length === 0) {
      // TODO: Show message that no files are selected
      return
    }

    // TODO: Implement discardFilesFromStash action
    // For now, just log
    console.log('Discard files:', selectedFiles.map(f => f.path))
  }

  private onDeleteStashClick = () => {
    const { repository, dispatcher } = this.props

    // Delete the entire stash entry
    dispatcher.dropSelectedStash(repository)
  }

  public render() {
    const { selectedFiles, isRestoring, isDiscarding } = this.props
    const { discardOnRestore } = this.state

    const discardButtonDisabled = selectedFiles.length === 0 || isDiscarding

    return (
      <div className="stash-actions-panel">
        {/* Discard on restore checkbox */}
        <div className="stash-options">
          <Checkbox
            value={discardOnRestore ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onDiscardOnRestoreChanged}
            label="Discard when restored"
          />
        </div>

        {/* Action buttons */}
        <div className="button-group">
          <Button
            onClick={this.onRestoreClick}
            disabled={isRestoring}
            type="submit"
            className="restore-button"
          >
            {isRestoring ? 'Restoring...' : 'Restore'}
          </Button>

          <Button
            onClick={this.onDiscardClick}
            disabled={discardButtonDisabled}
            className="discard-button"
          >
            {isDiscarding ? 'Discarding...' : 'Discard'}
          </Button>

          <Button
            onClick={this.onDeleteStashClick}
            disabled={isRestoring || isDiscarding}
            className="delete-button"
          >
            Delete Stash
          </Button>
        </div>
      </div>
    )
  }
}
