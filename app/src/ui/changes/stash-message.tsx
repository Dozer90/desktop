import * as React from 'react'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { Button } from '../lib/button'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { TextBox } from '../lib/text-box'
import { IStashEntry } from '../../models/stash-entry'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import {
  Popover,
  PopoverAnchorPosition,
  PopoverDecoration,
} from '../lib/popover'
import { FocusContainer } from '../lib/focus-container'

interface IStashMessageProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly isStashing: boolean
  readonly stashEntries: ReadonlyArray<IStashEntry>
  readonly selectedStashEntrySha: string | null
  readonly onSelectedStashChanged?: (stash: IStashEntry | null) => void
  readonly anyFilesSelected?: boolean
}

const enum StashMode {
  New,
  Existing,
}

interface IStashMessageState {
  readonly mode: StashMode
  readonly selectedStash: IStashEntry | null
  readonly stashName: string
  readonly description: string
  readonly discardAfterStash: boolean
  readonly showDropdown: boolean
  readonly showFilterPopover: boolean
  readonly filterCurrentBranch: boolean
  readonly filterGitDesktopStash: boolean
  readonly filterGitStash: boolean
}

export class StashMessage extends React.Component<
  IStashMessageProps,
  IStashMessageState
> {
  private dropdownRef = React.createRef<HTMLDivElement>()
  private filterButtonRef: HTMLButtonElement | null = null

  public constructor(props: IStashMessageProps) {
    super(props)
    const selectedStash =
      props.selectedStashEntrySha === null
        ? null
        : props.stashEntries.find(
            s => s.stashSha === props.selectedStashEntrySha
          ) ?? null
    this.state = {
      mode: selectedStash === null ? StashMode.New : StashMode.Existing,
      selectedStash,
      stashName: selectedStash?.userfriendlyName || '',
      description: selectedStash?.description || '',
      discardAfterStash: false,
      showDropdown: false,
      showFilterPopover: false,
      filterCurrentBranch: false,
      filterGitDesktopStash: false,
      filterGitStash: false,
    }
  }

  public componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside)
  }

  public componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside)
  }

  public componentWillReceiveProps(nextProps: IStashMessageProps) {
    if (
      nextProps.selectedStashEntrySha !== this.props.selectedStashEntrySha ||
      nextProps.stashEntries !== this.props.stashEntries
    ) {
      const selectedStash =
        nextProps.selectedStashEntrySha === null
          ? null
          : nextProps.stashEntries.find(
              s => s.stashSha === nextProps.selectedStashEntrySha
            ) ?? null

      this.setState({
        mode: selectedStash === null ? StashMode.New : StashMode.Existing,
        selectedStash,
        stashName: selectedStash?.userfriendlyName || '',
        description: selectedStash?.description || '',
      })
    }
  }

  private handleClickOutside = (event: MouseEvent) => {
    if (
      this.dropdownRef.current &&
      !this.dropdownRef.current.contains(event.target as Node)
    ) {
      this.setState({ showDropdown: false, showFilterPopover: false })
    }
  }

  private onStashNameChanged = (value: string) => {
    this.setState({ stashName: value })
  }

  private onDescriptionChanged = (
    event: React.FormEvent<HTMLTextAreaElement>
  ) => {
    this.setState({ description: event.currentTarget.value })
  }

  private onDiscardAfterStashChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.setState({ discardAfterStash: event.currentTarget.checked })
  }

  private toggleDropdown = () => {
    this.setState({ showDropdown: !this.state.showDropdown })
  }

  private toggleFilterPopover = () => {
    this.setState({ showFilterPopover: !this.state.showFilterPopover })
  }

  private closeFilterPopover = () => {
    this.setState({ showFilterPopover: false })
  }

  private onFilterButtonRef = (buttonRef: HTMLButtonElement | null) => {
    this.filterButtonRef = buttonRef
  }

  private onClearAllFilters = () => {
    this.setState({
      filterCurrentBranch: false,
      filterGitDesktopStash: false,
      filterGitStash: false,
    })
    this.closeFilterPopover()
  }

  private hasActiveFilters = (): boolean => {
    const { filterCurrentBranch, filterGitDesktopStash, filterGitStash } =
      this.state
    // Active filters means at least one is checked but not all
    const anyChecked =
      filterCurrentBranch || filterGitDesktopStash || filterGitStash
    const allChecked =
      filterCurrentBranch && filterGitDesktopStash && filterGitStash
    return anyChecked && !allChecked
  }

  private onStashSelected = (stash: IStashEntry | null) => {
    if (stash === null) {
      // New mode
      this.setState({
        mode: StashMode.New,
        selectedStash: null,
        stashName: '',
        description: '',
        showDropdown: false,
      })
      this.props.onSelectedStashChanged?.(null)
    } else {
      // Existing mode
      this.setState({
        mode: StashMode.Existing,
        selectedStash: stash,
        stashName: stash.userfriendlyName || '',
        description: stash.description || '',
        showDropdown: false,
      })
      this.props.onSelectedStashChanged?.(stash)
    }
  }

  private onFilterCurrentBranchChange = () => {
    this.setState(prev => ({ filterCurrentBranch: !prev.filterCurrentBranch }))
  }

  private onFilterGitDesktopStashChange = () => {
    this.setState(prev => ({
      filterGitDesktopStash: !prev.filterGitDesktopStash,
    }))
  }

  private onFilterGitStashChange = () => {
    this.setState(prev => ({ filterGitStash: !prev.filterGitStash }))
  }

  private onNewStashSelected = () => {
    this.onStashSelected(null)
  }

  private onStashItemClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const stashSha = event.currentTarget.getAttribute('data-stash-sha')
    const stash = this.props.stashEntries.find(s => s.stashSha === stashSha)
    if (stash) {
      this.onStashSelected(stash)
    }
  }

  private getFilteredStashes = (): ReadonlyArray<IStashEntry> => {
    const { stashEntries, repository } = this.props
    const { filterCurrentBranch, filterGitDesktopStash, filterGitStash } =
      this.state

    // If no filters are active OR all filters are active, show everything
    const anyChecked =
      filterCurrentBranch || filterGitDesktopStash || filterGitStash
    const allChecked =
      filterCurrentBranch && filterGitDesktopStash && filterGitStash

    if (!anyChecked || allChecked) {
      return stashEntries
    }

    // Otherwise, apply filters
    return stashEntries.filter(stash => {
      // Check branch filter
      const matchesBranch =
        !filterCurrentBranch || stash.branchName === repository.name

      // Check stash type filter
      const matchesType =
        (filterGitDesktopStash && stash.isGitHubDesktop) ||
        (filterGitStash && !stash.isGitHubDesktop)

      return matchesBranch && matchesType
    })
  }

  private getStashCount = (
    type: 'currentBranch' | 'gitDesktop' | 'git'
  ): number => {
    const { stashEntries, repository } = this.props

    switch (type) {
      case 'currentBranch':
        return stashEntries.filter(s => s.branchName === repository.name).length
      case 'gitDesktop':
        return stashEntries.filter(s => s.isGitHubDesktop).length
      case 'git':
        return stashEntries.filter(s => !s.isGitHubDesktop).length
    }
  }

  private onStashClick = async () => {
    const { repository, dispatcher } = this.props
    const { stashName, description, discardAfterStash, selectedStash, mode } =
      this.state

    if (mode === StashMode.Existing && selectedStash !== null) {
      dispatcher.addFilesToStashEntry(
        repository,
        selectedStash,
        stashName,
        description,
        discardAfterStash
      )
      return
    }

    dispatcher.createStashWithMessage(
      repository,
      stashName,
      description,
      discardAfterStash
    )
  }

  private renderStashItem = (stash: IStashEntry) => {
    return (
      <li key={stash.stashSha} className="stash-list-item">
        <button
          onClick={this.onStashItemClick}
          data-stash-sha={stash.stashSha}
          type="button"
        >
          <div className="stash-item-content">
            <div className="stash-name">
              {stash.userfriendlyName || stash.name}
            </div>
            {stash.description && (
              <div className="stash-description">{stash.description}</div>
            )}
          </div>
        </button>
      </li>
    )
  }

  private renderFilterPopover = () => {
    const {
      showFilterPopover,
      filterCurrentBranch,
      filterGitDesktopStash,
      filterGitStash,
    } = this.state

    if (!showFilterPopover) {
      return null
    }

    const filtersActive = this.hasActiveFilters()

    return (
      <Popover
        className="filter-popover"
        ariaLabelledby="stash-filter-options-header"
        anchor={this.filterButtonRef}
        anchorPosition={PopoverAnchorPosition.BottomRight}
        decoration={PopoverDecoration.Balloon}
        onMousedownOutside={this.closeFilterPopover}
        onClickOutside={this.closeFilterPopover}
      >
        <div className="filter-popover-header">
          <h3 id="stash-filter-options-header">Filter Options</h3>
          <button
            className="close"
            onClick={this.closeFilterPopover}
            aria-label="Close"
          >
            <Octicon symbol={octicons.x} />
          </button>
        </div>
        <div className="filter-options">
          <Checkbox
            label={`Current branch (${this.getStashCount('currentBranch')})`}
            value={filterCurrentBranch ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onFilterCurrentBranchChange}
          />
          <Checkbox
            label={`GitHub Desktop Stash (${this.getStashCount('gitDesktop')})`}
            value={filterGitDesktopStash ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onFilterGitDesktopStashChange}
          />
          <Checkbox
            label={`Git Stash (${this.getStashCount('git')})`}
            value={filterGitStash ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onFilterGitStashChange}
          />
        </div>
        {filtersActive && (
          <div className="filter-options-footer">
            <Button onClick={this.onClearAllFilters}>Clear filters</Button>
          </div>
        )}
      </Popover>
    )
  }

  private renderDropdown = () => {
    const { showDropdown } = this.state

    if (!showDropdown) {
      return null
    }

    const filteredStashes = this.getFilteredStashes()

    return (
      <div className="stash-dropdown">
        <ul className="stash-list">
          <li className="stash-list-item new-stash">
            <button onClick={this.onNewStashSelected} type="button">
              <span>New</span>
            </button>
          </li>
          {filteredStashes.map(this.renderStashItem)}
        </ul>
      </div>
    )
  }

  public render() {
    const { isStashing } = this.props
    const { mode, selectedStash, stashName, description, discardAfterStash } =
      this.state

    const isNewMode = mode === StashMode.New
    const stashDisabled = isStashing || !this.props.anyFilesSelected

    // Display the selected stash name in Existing mode, or the user input in New mode
    const displayValue = isNewMode
      ? stashName
      : selectedStash?.userfriendlyName || selectedStash?.name || ''

    const filtersActive = this.hasActiveFilters()
    const filterButtonClassName = filtersActive
      ? 'filter-button active'
      : 'filter-button'

    const className = 'stash-message-component with-action-bar'

    return (
      <div role="group" aria-label="Create stash" className={className}>
        {/* Summary row - replaced with stash selector */}
        <div className="name" ref={this.dropdownRef}>
          <div className="name-field filter-box-container">
            <Button
              className={filterButtonClassName}
              onClick={this.toggleFilterPopover}
              tooltip="Filter stashes"
              ariaLabel="Filter stashes"
              onButtonRef={this.onFilterButtonRef}
            >
              <span>
                <Octicon symbol={octicons.filter} />
              </span>
              {filtersActive ? (
                <span className="active-badge">
                  <div className="badge-bg">
                    <div className="badge"></div>
                  </div>
                </span>
              ) : null}
              <Octicon symbol={octicons.triangleDown} />
            </Button>
            {this.renderFilterPopover()}
            <TextBox
              placeholder={isNewMode ? 'New stash name' : 'Select stash'}
              value={displayValue}
              onValueChanged={this.onStashNameChanged}
              disabled={isStashing || !isNewMode}
            />
            <button
              className="dropdown-chevron"
              type="button"
              onClick={this.toggleDropdown}
              aria-label="Toggle stash dropdown"
            >
              <Octicon symbol={octicons.chevronDown} />
            </button>
          </div>
          {this.renderDropdown()}
        </div>

        {/* Description field */}
        <FocusContainer className="description-focus-container">
          <textarea
            className="description-field"
            placeholder={isNewMode ? 'Description' : ''}
            value={description}
            onChange={this.onDescriptionChanged}
            disabled={isStashing || !isNewMode}
            readOnly={!isNewMode}
          />
        </FocusContainer>

        {/* Discard checkbox - centered above button */}
        <div className="stash-options">
          <Checkbox
            value={discardAfterStash ? CheckboxValue.On : CheckboxValue.Off}
            onChange={this.onDiscardAfterStashChanged}
            label="Discard when stashed"
            disabled={isStashing}
          />
        </div>

        {/* Submit button */}
        <Button
          onClick={this.onStashClick}
          disabled={stashDisabled}
          type="submit"
        >
          {isStashing ? 'Stashing...' : isNewMode ? 'Stash' : 'Add to stash'}
        </Button>
      </div>
    )
  }
}
