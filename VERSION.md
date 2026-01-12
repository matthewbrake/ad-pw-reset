# Version History - Azure AD Password Notifier

## [v2.2.1] - Stability Update
### Fixed
- **JSON Stream Error**: Resolved "Unexpected non-whitespace character after JSON" by adding safer file read/write handling in the server.
- **Data Integrity**: Added fallback empty arrays for history, queue, and profiles if files are corrupted or empty.

## [v2.2.0] - Dashboard & Export
### Added
- **Advanced Filtering**: Toggle filters for "Enabled Only" and "Never Expire Only" on the dashboard.
- **Enhanced Visibility**: New columns in User Table: Account Status, Never Expire Policy, Last Reset Date, and Calculated Expiry Date.
- **Enterprise CSV Export**: Comprehensive export including all metadata fields.
- **VERSION.md**: Introduced this file to ensure no features are accidentally removed in future iterations.

### Logic Details
- **Hybrid Expiry Logic**: The system identifies users where `onPremisesSyncEnabled` is true. For these users, it ignores the cloud "DisablePasswordExpiration" flag and calculates expiry based on the configured "Default Expiry Days" from the settings tab.
- **Cloud-Only Logic**: Respects the `DisablePasswordExpiration` flag for native cloud users.

---

## [v2.1.0] - Audit & Scheduling
- **Audit & Scheduling**: Added Audit Logs and Delivery Queue.
- **Persistence**: Implemented `data/` root directory for JSON storage of profiles and settings.
- **Observability**: Added real-time System Console.

## [v2.0.0] - Foundation
- **Enterprise UI**: Tailwind-based dark mode interface.
- **Graph API Integration**: Daemon-based Client Credentials flow.
- **SMTP Engine**: Template-based notification system.
