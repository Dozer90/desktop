import * as React from 'react'
import { IStashEntry } from '../../models/stash-entry'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { PopupType } from '../../models/popup'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { ErrorWithMetadata } from '../../lib/error-with-metadata'
import { Select } from '../lib/select'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { getBoolean, setBoolean } from '../../lib/local-storage'

const popOnRestoreKey = 'stash-pop-on-restore'

interface IStashDiffHeaderProps {
  readonly stashEntry: IStashEntry
  readonly stashEntries: ReadonlyArray<IStashEntry>
  readonly onStashEntryChanged: (stashEntrySha: string) => void
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly askForConfirmationOnDiscardStash: boolean
}

interface IStashDiffHeaderState {
  readonly isRestoring: boolean
  readonly isDiscarding: boolean
  readonly isPopOnRestore: boolean
}

/**
 * Component to provide the actions that can be performed
 * on a stash while viewing a stash diff
 */
export class StashDiffHeader extends React.Component<
  IStashDiffHeaderProps,
  IStashDiffHeaderState
> {
  public constructor(props: IStashDiffHeaderProps) {
    super(props)

    const isPopOnRestore = getBoolean(popOnRestoreKey, true)

    this.state = {
      isRestoring: false,
      isDiscarding: false,
      isPopOnRestore,
    }
  }

  private onStashEntryChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    this.props.onStashEntryChanged(event.currentTarget.value)
  }

  public render() {
    const { isRestoring, isDiscarding, isPopOnRestore } = this.state

    return (
      <div className="header">
        <h3>Stashed changes</h3>
        <Select
          value={this.props.stashEntry.stashSha}
          onChange={this.onStashEntryChanged}
        >
          {this.props.stashEntries.map(stashEntry => {
            return (
              <option key={stashEntry.stashSha} value={stashEntry.stashSha}>
                {stashEntry.userfriendlyName ||
                  stashEntry.name + ' (' + stashEntry.stashSha + ')'}
              </option>
            )
          })}
        </Select>
        <div className="row">
          <OkCancelButtonGroup
            okButtonText="Restore"
            okButtonDisabled={isRestoring || isDiscarding}
            onOkButtonClick={this.onRestoreClick}
            cancelButtonText="Discard"
            cancelButtonDisabled={isRestoring || isDiscarding}
            onCancelButtonClick={this.onDiscardClick}
            okButtonAriaDescribedBy="restore-description"
          />
          <Checkbox
            value={isPopOnRestore ? CheckboxValue.On : CheckboxValue.Off}
            label="Remove from stash on restore"
            onChange={this.onPopOnRestoreCheckboxChanged}
          />
        </div>
      </div>
    )
  }

  private onPopOnRestoreCheckboxChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const isChecked = event.currentTarget.checked
    setBoolean(popOnRestoreKey, isChecked)
    this.setState({ isPopOnRestore: isChecked })
  }

  private onDiscardClick = async () => {
    const {
      dispatcher,
      repository,
      stashEntry,
      askForConfirmationOnDiscardStash,
    } = this.props

    if (!askForConfirmationOnDiscardStash) {
      this.setState({
        isDiscarding: true,
      })

      try {
        await dispatcher.dropSelectedStash(repository)
      } finally {
        this.setState({
          isDiscarding: false,
        })
      }
    } else {
      dispatcher.showPopup({
        type: PopupType.ConfirmDiscardStash,
        stash: stashEntry,
        repository,
      })
    }
  }

  private onRestoreClick = async () => {
    const { dispatcher, repository, stashEntry } = this.props

    try {
      this.setState({
        isRestoring: true,
      })
      if (this.state.isPopOnRestore) {
        await dispatcher.popStash(repository, stashEntry)
      } else {
        await dispatcher.applyStash(repository, stashEntry)
      }
    } catch (err) {
      const errorWithMetadata = new ErrorWithMetadata(err, {
        repository: repository,
      })
      dispatcher.postError(errorWithMetadata)
    } finally {
      this.setState({
        isRestoring: false,
      })
    }
  }
}
