using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "accounts",
                type: "character varying(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedEmail",
                table: "accounts",
                type: "character varying(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_accounts_NormalizedEmail",
                table: "accounts",
                column: "NormalizedEmail",
                unique: true,
                filter: "\"NormalizedEmail\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_accounts_NormalizedEmail",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "NormalizedEmail",
                table: "accounts");
        }
    }
}
