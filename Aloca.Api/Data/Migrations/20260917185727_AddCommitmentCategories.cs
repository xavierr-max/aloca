using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCommitmentCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CategoryId",
                table: "financial_commitments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_financial_commitments_CategoryId",
                table: "financial_commitments",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_financial_commitments_categories_CategoryId",
                table: "financial_commitments",
                column: "CategoryId",
                principalTable: "categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_financial_commitments_categories_CategoryId",
                table: "financial_commitments");

            migrationBuilder.DropIndex(
                name: "IX_financial_commitments_CategoryId",
                table: "financial_commitments");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "financial_commitments");
        }
    }
}
