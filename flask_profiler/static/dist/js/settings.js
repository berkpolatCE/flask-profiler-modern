$(document).on('ready', function () {
    $('#clear-settings-info').hide();

    $('.dump-database').click(function (e) {
        window.location = 'db/dumpDatabase';
    });

    $('.delete-database').click(function (e) {
        $.get("db/deleteDatabase", function (data) {
                if (data.status === true) {
                    $('#settings-info').text("All database data removed successfully");
                    $('#clear-settings-info').show();
                } else {
                    $('#settings-info').text("Some error occurred while deleting database data.");
                    $('#clear-settings-info').show();
                }
            }
        );
    });

    $('#clear-settings-info').click(function (e) {
        $('#settings-info').text("");
        $('#clear-settings-info').hide();
    });
});