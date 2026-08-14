//
//  Notification.Name+RestoreFromBackup.swift
//  Iron
//
//  Created by Karim Abou Zeid on 26.10.19.
//  Copyright © 2019 Karim Abou Zeid Software. All rights reserved.
//

import Foundation

let restoreFromBackupDataUserInfoKey = "restoreFromBackupData"

extension Notification.Name {
    static let OpenRestTimer = Notification.Name("OpenRestTimer")
    static let RestoreFromBackup = Notification.Name("RestoreFromBackup")
    static let ResetSwipeActions = Notification.Name("ResetSwipeActions")
}
