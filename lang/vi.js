/**
 * Vietnamese language strings
 */
module.exports = {
    // General responses
    error: "Đã xảy ra lỗi. Vui lòng thử lại sau.",
    success: "Thao tác hoàn tất thành công.",
    
    // Join command
    join: {
        success: "Tôi đã tham gia kênh thoại của bạn!",
        userNotInVoiceChannel: "Bạn cần vào kênh thoại trước!",
        alreadyConnected: "Tôi đã kết nối với một kênh thoại rồi!",
        inUseElsewhere: "Tôi đang được sử dụng trong <#{0}>. Vui lòng đợi cho đến khi họ hoàn thành.",
        connecting: "Đang kết nối tới {0}...",
        failed: "Không thể kết nối với kênh thoại. Vui lòng thử lại.",
        noPermission: "Tôi không có quyền tham gia kênh thoại của bạn.",
        error: "Không thể tham gia kênh thoại. Vui lòng thử lại."
    },
    
    // Leave command
    leave: {
        success: "Đã rời khỏi kênh thoại!",
        notConnected: "Tôi không kết nối với kênh thoại nào!",
        error: "Không thể rời khỏi kênh thoại."
    },
    
    // Say command
    say: {
        success: "Tin nhắn đã được gửi!",
        notConnected: "Tôi cần ở trong kênh thoại trước! Sử dụng /join",
        emptyMessage: "Vui lòng cung cấp tin nhắn để nói.",
        error: "Không thể gửi tin nhắn TTS."
    },
    
    // MyLanguage command
    myLanguage: {
        success: "Ngôn ngữ của bạn đã được đặt thành {0}!",
        reset: "Tùy chọn ngôn ngữ của bạn đã được đặt lại. Bạn sẽ sử dụng ngôn ngữ mặc định của máy chủ.",
        error: "Không thể đặt tùy chọn ngôn ngữ của bạn."
    },
    
    // Settings command
    settings: {
        current: "**Cài đặt máy chủ hiện tại**\\nNgôn ngữ: {0}\\nTắt tên người dùng: {1}\\nTắt thông báo tham gia/rời đi: {2}",
        updated: "Cài đặt đã được cập nhật!",
        language: {
            changed: "Ngôn ngữ máy chủ đã được đặt thành {0}!",
            invalid: "Mã ngôn ngữ không hợp lệ. Các ngôn ngữ có sẵn: {0}"
        },
        joinLeaveMessages: {
            enabled: "Thông báo tham gia/rời đi đã được bật.",
            disabled: "Thông báo tham gia/rời đi đã bị tắt."
        },
        usernames: {
            enabled: "Tên người dùng sẽ được thông báo.",
            disabled: "Tên người dùng sẽ không còn được thông báo."
        },
        error: "Không thể cập nhật cài đặt."
    },
    
    // Help command
    help: {
        title: "Các lệnh Bot TTS",
        join: "Tham gia kênh thoại của bạn",
        leave: "Rời khỏi kênh thoại",
        say: "Yêu cầu bot nói điều gì đó",
        myLanguage: "Đặt ngôn ngữ TTS cá nhân của bạn",
        settings: "Thay đổi cài đặt máy chủ",
        help: "Hiển thị hướng dẫn này",
        footer: "Nhập / để xem các lệnh có sẵn"
    },

    // Voice events
    voiceEvents: {
        userJoined: "{0} đã tham gia kênh",
        userLeft: "{0} đã rời kênh"
    }
};