import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'
import { Row } from '../lib/row'

type FileSelection = 'none' | 'checked' | 'unchecked' | 'all'

interface ICreateNewStashDialogProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
}

interface ICreateNewStashDialogState {
  readonly stashName: string
  readonly fileSelection: FileSelection
  readonly isCreating: boolean
}

export class CreateNewStashDialog extends React.Component<
  ICreateNewStashDialogProps,
  ICreateNewStashDialogState
> {
  public constructor(props: ICreateNewStashDialogProps) {
    super(props)
    this.state = {
      stashName: '',
      fileSelection: 'all',
      isCreating: false,
    }
  }

  private onStashNameChange = (value: string) => {
    this.setState({ stashName: value })
  }

  private onFileSelectionChange = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.setState({
      fileSelection: event.currentTarget.value as FileSelection,
    })
  }

  private onCreateStash = async () => {
    const { repository, dispatcher } = this.props
    const { stashName, fileSelection } = this.state

    this.setState({ isCreating: true })

    // Append 'desktop' tag to identify Desktop-created stashes
    const fullMessage = stashName ? `${stashName} - desktop` : 'desktop'

    await dispatcher.createStashForFiles(repository, fileSelection, fullMessage)

    this.props.onDismissed()
  }

  public render() {
    const { isCreating, stashName, fileSelection } = this.state

    return (
      <Dialog
        title="Create New Stash"
        onDismissed={this.props.onDismissed}
        onSubmit={this.onCreateStash}
        disabled={isCreating}
      >
        <DialogContent>
          <Row>
            <TextBox
              label="Stash name (optional)"
              placeholder="e.g., WIP: feature implementation"
              value={stashName}
              onValueChanged={this.onStashNameChange}
              disabled={isCreating}
            />
          </Row>

          <Row>
            <fieldset>
              <legend>Files to stash</legend>
              <Row>
                <input
                  type="radio"
                  id="stash-none"
                  name="file-selection"
                  value="none"
                  checked={fileSelection === 'none'}
                  onChange={this.onFileSelectionChange}
                  disabled={isCreating}
                />
                <label htmlFor="stash-none">None (create empty stash)</label>
              </Row>
              <Row>
                <input
                  type="radio"
                  id="stash-checked"
                  name="file-selection"
                  value="checked"
                  checked={fileSelection === 'checked'}
                  onChange={this.onFileSelectionChange}
                  disabled={isCreating}
                />
                <label htmlFor="stash-checked">Checked files only</label>
              </Row>
              <Row>
                <input
                  type="radio"
                  id="stash-unchecked"
                  name="file-selection"
                  value="unchecked"
                  checked={fileSelection === 'unchecked'}
                  onChange={this.onFileSelectionChange}
                  disabled={isCreating}
                />
                <label htmlFor="stash-unchecked">Unchecked files only</label>
              </Row>
              <Row>
                <input
                  type="radio"
                  id="stash-all"
                  name="file-selection"
                  value="all"
                  checked={fileSelection === 'all'}
                  onChange={this.onFileSelectionChange}
                  disabled={isCreating}
                />
                <label htmlFor="stash-all">All changed files</label>
              </Row>
            </fieldset>
          </Row>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={isCreating ? 'Creating Stash…' : 'Create Stash'}
            okButtonDisabled={isCreating}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
