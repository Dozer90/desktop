import * as React from 'react'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { IStashEntry, StashedChangesLoadStates } from '../../models/stash-entry'
import { CommittedFileChange } from '../../models/status'
import { PopupType } from '../../models/popup'
import { Button } from '../lib/button'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { getBoolean, setBoolean } from '../../lib/local-storage'

const discardOnRestoreKey = 'stash-discard-on-restore'

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

    const discardOnRestore = getBoolean(discardOnRestoreKey, true)

    this.state = {
      discardOnRestore,
    }
  }

  private onDiscardOnRestoreChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked
    setBoolean(discardOnRestoreKey, value)
    this.setState({ discardOnRestore: value })
  }

  private onRestoreClick = () => {
    const { repository, dispatcher, stashEntry, selectedFiles } = this.props
    const { discardOnRestore } = this.state

    if (selectedFiles.length === 0) {
      return
    }

    dispatcher.restoreStashFiles(
      repository,
      stashEntry,
      selectedFiles,
      discardOnRestore
    )
  }

  private onDiscardClick = () => {
    const { repository, dispatcher, stashEntry, selectedFiles } = this.props

    if (selectedFiles.length === 0) {
      // TODO: Show message that no files are selected
      return
    }

    dispatcher.discardStashFiles(repository, stashEntry, selectedFiles)
  }

  private onDeleteStashClick = () => {
    const { repository, dispatcher } = this.props
    const hasFiles =
      this.props.stashEntry.files.kind === StashedChangesLoadStates.Loaded
        ? this.props.stashEntry.files.files.length > 0
        : false

    if (hasFiles) {
      dispatcher.showPopup({
        type: PopupType.ConfirmDiscardStash,
        stash: this.props.stashEntry,
        repository,
      })
      return
    }

    dispatcher.dropSelectedStash(repository)
  }

  public render() {
    const { selectedFiles, isRestoring, isDiscarding } = this.props
    const { discardOnRestore } = this.state

    const hasSelectedFiles = selectedFiles.length > 0
    const restoreButtonDisabled = !hasSelectedFiles || isRestoring
    const discardButtonDisabled = !hasSelectedFiles || isDiscarding

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
            disabled={restoreButtonDisabled}
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

          <Button onClick={this.onDeleteStashClick} className="drop-button">
            Drop Stash
          </Button>
        </div>
      </div>
    )
  }
}
